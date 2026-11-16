import { randomUUID } from 'node:crypto';
import type { ExternalCompetition, SportsProvider } from '@edr/contracts';
import type { AppContainer } from '../../container.js';
import type { IngestionSource } from '../../providers/sports/ingestion/types.js';
import { HttpProblem } from '../../platform/http/problem.js';
import type { Db } from '../../platform/db/db.js';
import { constraintKind } from '../../platform/db/errors.js';
import { SourceError } from '../../providers/sports/ingestion/errors.js';

interface BindingRow {
  id: string;
  competition_id: string;
  provider_key: string;
  provider_name: string;
  source_id: string;
  external_competition_id: string;
  external_competition_name: string;
  mode: 'provider' | 'hybrid';
  status: 'active' | 'replaced' | 'unlinked';
  linked_at: string;
  unlinked_at: string | null;
  created_at: string;
  updated_at: string;
}

export class CompetitionProviderBindingService {
  readonly #container: AppContainer;
  readonly #db: Db;
  constructor(container: AppContainer) {
    this.#container = container;
    this.#db = container.db;
  }

  providers(): SportsProvider[] {
    return this.#container.sources.providerCatalog.map((provider) => {
      const configured = this.#container.config.providers.sports.sources.filter(
        (source) => source.adapter === provider.key,
      );
      const active = configured.filter((source) => source.enabled);
      const availability =
        active.length > 1
          ? 'ambiguous'
          : active.length === 1
            ? 'available'
            : configured.length > 0
              ? 'disabled'
              : 'not_configured';
      const availabilityMessage =
        availability === 'ambiguous'
          ? 'Hay varias configuraciones activas para este proveedor. Contacta al administrador.'
          : availability === 'disabled'
            ? 'El proveedor está deshabilitado. Solicita al administrador que lo habilite.'
            : availability === 'not_configured'
              ? 'El administrador debe configurar el proveedor y sus credenciales en el servidor.'
              : null;
      return {
        key: provider.key,
        name: provider.name,
        capabilities: provider.capabilities,
        availability,
        availabilityMessage,
      };
    });
  }

  async externalCompetitions(providerKey: string): Promise<ExternalCompetition[]> {
    const source = this.#source(providerKey);
    try {
      const listing = await source.listCompetitions({ signal: new AbortController().signal, purpose: 'discovery' });
      return listing.items.map((item) => ({
        externalCompetitionId: item.localKey,
        name: item.name,
        areaName: item.areaName,
      }));
    } catch (error) {
      if (error instanceof SourceError && error.code === 'rate_limited') {
        throw new HttpProblem(503, 'PROVIDER_RATE_LIMITED', 'Se alcanzó el límite de solicitudes del proveedor.', {
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      throw new HttpProblem(
        503,
        'PROVIDER_FAILED',
        'No se pudieron consultar las competiciones del proveedor. Inténtalo de nuevo.',
      );
    }
  }

  get(competitionId: string): BindingRow | null {
    this.#requireCompetition(competitionId);
    const row = this.#db
      .prepare<BindingRow>("SELECT * FROM competition_provider_bindings WHERE competition_id = ? AND status = 'active'")
      .get([competitionId]);
    return row ?? null;
  }

  async link(
    competitionId: string,
    providerKey: string,
    externalId: string,
    mode: 'provider' | 'hybrid',
    replace: boolean,
  ) {
    this.#requireCompetition(competitionId);
    const active = this.get(competitionId);
    const at = this.#container.clock.now().toISOString();
    if (active && active.provider_key === providerKey && active.external_competition_id === externalId) {
      if (active.mode === mode) return active;
      this.#db
        .prepare("UPDATE competition_provider_bindings SET mode = ?, updated_at = ? WHERE id = ? AND status = 'active'")
        .run([mode, at, active.id]);
      return this.get(competitionId);
    }
    const source = this.#source(providerKey);
    const items = await this.externalCompetitions(providerKey);
    const selected = items.find((item) => item.externalCompetitionId === externalId);
    if (!selected)
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        'La competición externa seleccionada ya no está disponible. Actualiza la lista e inténtalo de nuevo.',
      );
    if (active && !replace)
      throw new HttpProblem(
        409,
        'PROVIDER_BINDING_EXISTS',
        'Esta competición ya tiene un proveedor vinculado. Confirma el reemplazo para continuar.',
      );
    const newId = randomUUID();
    try {
      this.#db.transaction(() => {
        if (active)
          this.#db
            .prepare(
              "UPDATE competition_provider_bindings SET status = 'replaced', unlinked_at = ?, updated_at = ? WHERE id = ? AND status = 'active'",
            )
            .run([at, at, active.id]);
        this.#db
          .prepare(
            `INSERT INTO competition_provider_bindings
          (id, competition_id, provider_key, provider_name, source_id, external_competition_id, external_competition_name, mode, status, linked_at, unlinked_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?, ?)`,
          )
          .run([
            newId,
            competitionId,
            providerKey,
            source.descriptor.name,
            source.descriptor.id,
            selected.externalCompetitionId,
            selected.name,
            mode,
            at,
            at,
            at,
          ]);
      });
    } catch (error) {
      if (constraintKind(error) === 'unique')
        throw new HttpProblem(409, 'PROVIDER_BINDING_EXISTS', 'Esta competición ya tiene un proveedor vinculado.');
      throw error;
    }
    return this.get(competitionId);
  }

  unlink(competitionId: string): void {
    this.#requireCompetition(competitionId);
    const at = this.#container.clock.now().toISOString();
    this.#db
      .prepare(
        "UPDATE competition_provider_bindings SET status = 'unlinked', unlinked_at = ?, updated_at = ? WHERE competition_id = ? AND status = 'active'",
      )
      .run([at, at, competitionId]);
  }

  #source(providerKey: string): IngestionSource {
    const descriptor = this.providers().find((provider) => provider.key === providerKey);
    if (!descriptor) {
      throw new HttpProblem(404, 'NOT_FOUND', 'El proveedor solicitado no existe.');
    }
    if (descriptor.availability !== 'available') {
      throw new HttpProblem(
        descriptor?.availability === 'ambiguous' ? 409 : 503,
        descriptor?.availability === 'ambiguous' ? 'PROVIDER_AMBIGUOUS' : 'PROVIDER_UNAVAILABLE',
        descriptor?.availabilityMessage ?? 'El proveedor solicitado no está disponible.',
      );
    }
    const matches = this.#container.sources
      .list()
      .filter(
        (item) =>
          item.descriptor.adapter === providerKey && item.descriptor.mode === 'LIVE_DATA' && item.descriptor.enabled,
      );
    if (matches.length !== 1) {
      if (matches.length > 1)
        throw new HttpProblem(
          409,
          'PROVIDER_AMBIGUOUS',
          'El proveedor tiene más de una configuración activa; contacta al administrador.',
        );
      throw new HttpProblem(404, 'NOT_FOUND', 'El proveedor solicitado no está disponible.');
    }
    return matches[0]!;
  }

  #requireCompetition(id: string): void {
    if (!this.#db.prepare<{ found: number }>('SELECT 1 AS found FROM competitions WHERE id = ?').get([id])) {
      throw new HttpProblem(404, 'NOT_FOUND', 'La competición no existe.');
    }
  }
}

export function bindingResponse(row: BindingRow | null) {
  return {
    binding:
      row === null
        ? null
        : {
            id: row.id,
            competitionId: row.competition_id,
            providerKey: row.provider_key,
            providerName: row.provider_name,
            externalCompetitionId: row.external_competition_id,
            externalCompetitionName: row.external_competition_name,
            mode: row.mode,
            status: row.status,
            linkedAt: row.linked_at,
            unlinkedAt: row.unlinked_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
  };
}
