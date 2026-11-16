import { createHash, randomUUID } from 'node:crypto';
import {
  ImportPreviewSchema,
  type ImportPreview,
  type ImportPreviewCreate,
  type ImportPreviewItem,
  type ImportResource,
} from '@edr/contracts';
import type { AppContainer } from '../../container.js';
import type { Db } from '../../platform/db/db.js';
import { HttpProblem } from '../../platform/http/problem.js';
import { ContractResponseError } from '../projects/respond.js';
import { SourceError } from '../../providers/sports/ingestion/errors.js';
import { type IngestionSource, type SourceRef, type SourceStage } from '../../providers/sports/ingestion/index.js';
import { normalizeKickoff, previewIncomplete } from './import-transform.js';

const TTL_MS = 30 * 60 * 1000;
const RESOURCE_ORDER: readonly ImportResource[] = [
  'season',
  'teams',
  'participants',
  'stages',
  'rounds',
  'matches',
  'results',
];
type BindingRow = {
  id: string;
  competition_id: string;
  provider_key: string;
  source_id: string;
  external_competition_id: string;
  external_competition_name: string;
};
type LocalCandidate = { id: string; label: string };

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function normalize(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('es');
}

export class CompetitionImportPreviewService {
  readonly #container: AppContainer;
  readonly #db: Db;
  readonly #inFlight = new Map<string, Promise<ImportPreview>>();
  constructor(container: AppContainer) {
    this.#container = container;
    this.#db = container.db;
  }

  async seasons(competitionId: string) {
    const { binding, source } = this.#context(competitionId);
    const competitionRef = await this.#competitionRef(source, binding);
    const listing = await source.listSeasons(competitionRef, this.#contextForProvider());
    const local = this.#db
      .prepare<{ id: string; label: string }>(
        'SELECT id, label FROM competition_seasons WHERE competition_id = ? ORDER BY created_at DESC',
      )
      .all([competitionId]);
    return {
      seasons: listing.items.map((season) => ({
        externalSeasonId: season.id,
        label: season.label,
        startDate: season.startDate,
        endDate: season.endDate,
        current: season.current,
        localCandidates: local
          .filter((item) => normalize(item.label) === normalize(season.label))
          .map(({ id, label }) => ({ id, label })),
      })),
    };
  }

  async capabilities(competitionId: string, externalSeasonId: string) {
    const context = await this.#seasonContext(competitionId, externalSeasonId);
    const stages = await context.source.listStages(
      context.competitionRef,
      context.season.ref,
      this.#contextForProvider(),
    );
    return { capabilities: this.#capabilities(stages.items) };
  }

  async create(competitionId: string, input: ImportPreviewCreate): Promise<ImportPreview> {
    const key = JSON.stringify([
      competitionId,
      input.externalSeasonId,
      input.destinationSeasonId ?? null,
      [...input.resources].sort(),
    ]);
    const active = this.#inFlight.get(key);
    if (active) return active;
    const pending = this.#createOne(competitionId, input);
    this.#inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      this.#inFlight.delete(key);
    }
  }

  async createWithProgress(
    competitionId: string,
    input: ImportPreviewCreate,
    onStage: (
      stage: 'fetching' | 'normalizing' | 'comparing' | 'preparing_preview',
      state: 'started' | 'completed',
    ) => void,
    signal: AbortSignal,
  ): Promise<ImportPreview> {
    return this.#createOne(competitionId, input, onStage, signal);
  }

  async #createOne(
    competitionId: string,
    input: ImportPreviewCreate,
    onStage?: (
      stage: 'fetching' | 'normalizing' | 'comparing' | 'preparing_preview',
      state: 'started' | 'completed',
    ) => void,
    signal?: AbortSignal,
  ): Promise<ImportPreview> {
    const checkCancelled = () => {
      if (signal?.aborted)
        throw signal.reason instanceof Error ? signal.reason : new Error('preview operation cancelled');
    };
    const startedAt = performance.now();
    let providerWaitMs = 0;
    let selectionReads = 0;
    const { binding } = this.#context(competitionId);
    const resourceSet = new Set(input.resources);
    const existing = this.#db
      .prepare<{ preview_json: string; local_fingerprint: string }>(
        // A snapshot that was already applied (PD-ARCH-01D-C) is never offered again as a new preview.
        'SELECT preview_json, local_fingerprint FROM competition_import_previews WHERE competition_id = ? AND binding_id = ? AND external_season_id = ? AND destination_season_id IS ? AND expires_at > ? AND id NOT IN (SELECT preview_id FROM competition_import_applications) ORDER BY retrieved_at DESC LIMIT 10',
      )
      .all([
        competitionId,
        binding.id,
        input.externalSeasonId,
        input.destinationSeasonId ?? null,
        this.#container.clock.now().toISOString(),
      ]);
    for (const row of existing) {
      const checked = ImportPreviewSchema.safeParse(JSON.parse(row.preview_json));
      if (
        checked.success &&
        !previewIncomplete(checked.data) &&
        checked.data.resources.length === resourceSet.size &&
        checked.data.resources.every((resource) => resourceSet.has(resource)) &&
        row.local_fingerprint === this.#fingerprint(competitionId, input.destinationSeasonId ?? null)
      ) {
        return checked.data;
      }
    }
    checkCancelled();
    onStage?.('fetching', 'started');
    const seasonStartedAt = performance.now();
    const context = await this.#seasonContext(competitionId, input.externalSeasonId, signal);
    providerWaitMs += performance.now() - seasonStartedAt;
    if (input.destinationSeasonId) {
      const destination = this.#db
        .prepare<{ id: string }>('SELECT id FROM competition_seasons WHERE id = ? AND competition_id = ?')
        .get([input.destinationSeasonId, competitionId]);
      if (!destination)
        throw new HttpProblem(
          400,
          'VALIDATION_FAILED',
          'La temporada local seleccionada no pertenece a esta competición.',
        );
    }
    const stageStartedAt = performance.now();
    const stageListing = await context.source.listStages(
      context.competitionRef,
      context.season.ref,
      this.#contextForProvider(signal),
    );
    providerWaitMs += performance.now() - stageStartedAt;
    const capabilities = this.#capabilities(stageListing.items);
    const unsupported = input.resources.filter(
      (resource) => !capabilities.find((item) => item.resource === resource)?.available,
    );
    if (unsupported.length)
      throw new HttpProblem(
        400,
        'VALIDATION_FAILED',
        'La selección incluye recursos no disponibles para esta temporada.',
      );
    const records: ImportPreviewItem[] = [];
    const warningOccurrences: Array<{ message: string; affectedExternalId?: string }> = [];
    const addWarning = (message: string, affectedExternalIds?: string | readonly string[]) => {
      const ids = typeof affectedExternalIds === 'string' ? [affectedExternalIds] : (affectedExternalIds ?? []);
      if (ids.length === 0) warningOccurrences.push({ message });
      else for (const affectedExternalId of ids) warningOccurrences.push({ message, affectedExternalId });
    };
    const seen = new Set<string>();
    const add = (item: ImportPreviewItem) => {
      const key = `${item.resource}:${item.externalScope ?? ''}:${item.externalId}`;
      if (records.length < 10000 && !seen.has(key)) {
        seen.add(key);
        records.push(item);
      }
    };
    const selected = new Set(input.resources);
    if (selected.has('season')) {
      const candidates = this.#db
        .prepare<LocalCandidate>('SELECT id, label FROM competition_seasons WHERE competition_id = ?')
        .all([competitionId]);
      const candidate = candidates.find((item) => normalize(item.label) === normalize(context.season.label)) ?? null;
      add(
        this.#item(
          'season',
          context.season.id,
          context.season.label,
          candidate ? 'conflict' : 'new',
          candidate,
          [
            {
              name: 'label',
              localValue: candidate?.label ?? null,
              incomingValue: context.season.label,
              baselineValue: null,
              protected: candidate !== null,
            },
          ],
          candidate ? ['Coincidencia por nombre; confirma manualmente si es la misma temporada.'] : [],
          [{ role: 'season', externalId: context.season.id, externalScope: context.binding.external_competition_id }],
          context.binding.external_competition_id,
        ),
      );
    }
    if (selected.has('stages')) {
      const localStages = input.destinationSeasonId
        ? this.#db
            .prepare<{ id: string; name: string }>('SELECT id, name FROM competition_stages WHERE season_id = ?')
            .all([input.destinationSeasonId])
        : [];
      for (const stage of stageListing.items) {
        const candidate = localStages.find((item) => normalize(item.name) === normalize(stage.name)) ?? null;
        add(
          this.#item(
            'stages',
            stage.id,
            stage.name,
            candidate ? 'conflict' : 'new',
            candidate ? { id: candidate.id, label: candidate.name } : null,
            [
              {
                name: 'name',
                localValue: candidate?.name ?? null,
                incomingValue: stage.name,
                baselineValue: null,
                protected: candidate !== null,
              },
            ],
            candidate ? ['Posible coincidencia por nombre; no se asociará automáticamente.'] : [],
            [{ role: 'season', externalId: context.season.id, externalScope: context.binding.external_competition_id }],
            `${context.binding.external_competition_id}:${context.season.id}`,
          ),
        );
      }
    }
    if (selected.has('rounds')) {
      const localRounds = input.destinationSeasonId
        ? this.#db
            .prepare<{ id: string; name: string }>('SELECT id, name FROM competition_rounds WHERE season_id = ?')
            .all([input.destinationSeasonId])
        : [];
      for (const stage of stageListing.items)
        for (const day of stage.matchdays) {
          const label = `Jornada ${day.number}`;
          const candidate = localRounds.find((item) => normalize(item.name) === normalize(label)) ?? null;
          add(
            this.#item(
              'rounds',
              `${stage.id}:${day.number}`,
              label,
              candidate ? 'conflict' : 'new',
              candidate ? { id: candidate.id, label: candidate.name } : null,
              [
                {
                  name: 'name',
                  localValue: candidate?.name ?? null,
                  incomingValue: label,
                  baselineValue: null,
                  protected: candidate !== null,
                },
              ],
              candidate ? ['Posible coincidencia por nombre; fase/ronda requiere confirmación.'] : [],
              [
                {
                  role: 'season',
                  externalId: context.season.id,
                  externalScope: context.binding.external_competition_id,
                },
                {
                  role: 'stage',
                  externalId: stage.id,
                  externalScope: `${context.binding.external_competition_id}:${context.season.id}`,
                },
                {
                  role: 'round',
                  externalId: `${stage.id}:${day.number}`,
                  externalScope: `${context.binding.external_competition_id}:${context.season.id}`,
                },
              ],
              `${context.binding.external_competition_id}:${context.season.id}`,
            ),
          );
        }
    }
    const wantsSnapshot = ['teams', 'participants', 'matches', 'results'].some((resource) =>
      selected.has(resource as ImportResource),
    );
    if (wantsSnapshot) {
      const refs = stageListing.items.flatMap((stage) => this.#selectionRefs(stage));
      if (refs.length > 120)
        addWarning(
          'Se limitaron las consultas a 120 selecciones de fase/jornada para respetar el presupuesto del proveedor.',
        );
      const localTeams = this.#db
        .prepare<{ id: string; name: string; region: string | null }>(
          'SELECT id, name, region FROM managed_teams ORDER BY id',
        )
        .all();
      const localParticipants = input.destinationSeasonId
        ? this.#db
            .prepare<{ id: string; name: string }>(
              'SELECT t.id, t.name FROM season_participants sp JOIN managed_teams t ON t.id = sp.team_id WHERE sp.season_id = ?',
            )
            .all([input.destinationSeasonId])
        : [];
      const localMatches = input.destinationSeasonId
        ? this.#db
            .prepare<{
              id: string;
              kickoff_at: string | null;
              home: string;
              away: string;
              status: string;
              home_score: number | null;
              away_score: number | null;
              stage_name: string | null;
              round_name: string | null;
            }>(
              `SELECT m.id, m.kickoff_at, h.name AS home, a.name AS away, m.status, r.home_score, r.away_score, st.name AS stage_name, ro.name AS round_name FROM competition_matches m JOIN managed_teams h ON h.id=m.home_team_id JOIN managed_teams a ON a.id=m.away_team_id LEFT JOIN match_results r ON r.match_id=m.id LEFT JOIN competition_stages st ON st.id=m.stage_id LEFT JOIN competition_rounds ro ON ro.id=m.round_id WHERE m.season_id=?`,
            )
            .all([input.destinationSeasonId])
        : [];
      const fetched = new Map<SourceRef, Awaited<ReturnType<IngestionSource['fetchSelection']>> | SourceError>();
      for (const ref of refs.slice(0, 120)) {
        checkCancelled();
        const selectionStartedAt = performance.now();
        selectionReads += 1;
        try {
          fetched.set(ref, await context.source.fetchSelection(ref, this.#contextForProvider(signal)));
        } catch (error) {
          if (!(error instanceof SourceError)) throw error;
          fetched.set(ref, error);
        }
        providerWaitMs += performance.now() - selectionStartedAt;
      }
      checkCancelled();
      onStage?.('fetching', 'completed');
      onStage?.('normalizing', 'started');
      onStage?.('normalizing', 'completed');
      onStage?.('comparing', 'started');
      for (const ref of refs.slice(0, 120)) {
        checkCancelled();
        const sourceStage = stageListing.items.find(
          (stage) => stage.wholeStageRef === ref || stage.matchdays.some((day) => day.ref === ref),
        );
        const loaded = fetched.get(ref);
        let snapshot;
        try {
          if (loaded instanceof SourceError) throw loaded;
          if (!loaded) throw new Error('selection snapshot missing');
          snapshot = loaded;
        } catch (error) {
          if (!(error instanceof SourceError)) throw error;
          const safeId = `selection-${sha(ref).slice(0, 16)}`;
          add(
            this.#item(
              'matches',
              safeId,
              'Selección no disponible',
              'skipped',
              null,
              [],
              ['No se pudo consultar esta selección del proveedor. Revisa la conexión o inténtalo de nuevo.'],
            ),
          );
          addWarning('Una o más selecciones no pudieron consultarse; se indican como omitidas en el resumen.', safeId);
          continue;
        }
        const teamByKey = new Map(snapshot.teams.map((team) => [team.teamKey, team]));
        if (selected.has('teams'))
          for (const team of snapshot.teams) {
            const matches = localTeams.filter((item) => normalize(item.name) === normalize(team.name));
            const candidate = matches.length === 1 ? { id: matches[0]!.id, label: matches[0]!.name } : null;
            add(
              this.#item(
                'teams',
                team.teamKey,
                team.name,
                matches.length ? 'conflict' : 'new',
                candidate,
                [
                  {
                    name: 'name',
                    localValue: candidate?.label ?? null,
                    incomingValue: team.name,
                    baselineValue: null,
                    protected: matches.length > 0,
                  },
                ],
                matches.length ? ['Posible duplicado; la identidad del equipo requiere decisión explícita.'] : [],
                [],
                null,
              ),
            );
          }
        if (selected.has('participants')) {
          if (snapshot.standings.available)
            for (const row of snapshot.standings.rows) {
              const team = teamByKey.get(row.teamKey);
              if (!team) continue;
              const matches = localTeams.filter((item) => normalize(item.name) === normalize(team.name));
              const isParticipant = matches.some((candidate) =>
                localParticipants.some((item) => item.id === candidate.id),
              );
              add(
                this.#item(
                  'participants',
                  `${snapshot.stage.name}:${row.teamKey}`,
                  team.name,
                  matches.length ? 'conflict' : 'new',
                  matches.length === 1 ? { id: matches[0]!.id, label: matches[0]!.name } : null,
                  [
                    {
                      name: 'participant',
                      localValue: isParticipant ? 'Presente localmente' : null,
                      incomingValue: 'Participante externo',
                      baselineValue: null,
                      protected: matches.length > 0,
                    },
                  ],
                  matches.length ? ['Posible coincidencia con equipo local; no se inscribirá automáticamente.'] : [],
                  [
                    {
                      role: 'season',
                      externalId: context.season.id,
                      externalScope: context.binding.external_competition_id,
                    },
                    { role: 'team', externalId: row.teamKey, externalScope: null },
                  ],
                  `${context.binding.external_competition_id}:${context.season.id}`,
                ),
              );
            }
          else
            addWarning(
              snapshot.standings.reason === 'not_available_with_subscription'
                ? 'El proveedor no ofrece la tabla de participantes con la suscripción configurada.'
                : 'El proveedor no entregó una tabla de participantes para una o más selecciones.',
              sourceStage?.id ?? snapshot.stage.name,
            );
        }
        if (selected.has('matches') || selected.has('results'))
          for (const match of snapshot.matches) {
            const home = teamByKey.get(match.homeTeamKey)?.name ?? 'Equipo local no identificado';
            const away = teamByKey.get(match.awayTeamKey)?.name ?? 'Equipo visitante no identificado';
            // The same instant in another spelling (a provider's `…:00Z` against the stored `…:00.000Z`) is the same
            // kickoff: compared as a string it hid the conflict with a protected local value (UI-06.3).
            const kickoff = normalizeKickoff(match.kickoff);
            const candidate =
              localMatches.find(
                (item) =>
                  normalize(item.home) === normalize(home) &&
                  normalize(item.away) === normalize(away) &&
                  kickoff !== undefined &&
                  normalizeKickoff(item.kickoff_at) === kickoff,
              ) ?? null;
            const mapped = this.#localStatus(match.status);
            const roundLabel = snapshot.stage.matchday === null ? null : `Jornada ${snapshot.stage.matchday}`;
            if (selected.has('matches'))
              add(
                this.#item(
                  'matches',
                  match.matchKey,
                  `${home} vs ${away}`,
                  mapped ? (candidate ? 'conflict' : 'new') : 'invalid',
                  candidate ? { id: candidate.id, label: `${candidate.home} vs ${candidate.away}` } : null,
                  [
                    {
                      name: 'fase',
                      localValue: candidate?.stage_name ?? null,
                      incomingValue: snapshot.stage.name,
                      baselineValue: null,
                      protected: candidate?.stage_name !== null && candidate?.stage_name !== undefined,
                    },
                    {
                      name: 'jornada',
                      localValue: candidate?.round_name ?? null,
                      incomingValue: roundLabel,
                      baselineValue: null,
                      protected: candidate?.round_name !== null && candidate?.round_name !== undefined,
                    },
                    {
                      name: 'fecha',
                      localValue: candidate?.kickoff_at ?? null,
                      incomingValue: match.kickoff,
                      baselineValue: null,
                      protected: candidate !== null,
                    },
                    {
                      name: 'estado',
                      localValue: candidate?.status ?? null,
                      incomingValue: mapped,
                      baselineValue: null,
                      protected: candidate !== null,
                    },
                    {
                      name: 'marcador',
                      localValue:
                        candidate && candidate.home_score !== null && candidate.away_score !== null
                          ? `${candidate.home_score}-${candidate.away_score}`
                          : null,
                      incomingValue: match.score === null ? null : `${match.score.home}-${match.score.away}`,
                      baselineValue: null,
                      protected:
                        candidate !== null &&
                        match.score !== null &&
                        candidate.home_score !== null &&
                        candidate.away_score !== null &&
                        (candidate.home_score !== match.score.home || candidate.away_score !== match.score.away),
                    },
                  ],
                  mapped
                    ? candidate
                      ? ['Posible coincidencia de partido; mapping externo no confirmado.']
                      : []
                    : [`Estado externo "${match.status}" sin equivalencia segura.`],
                  [
                    {
                      role: 'season',
                      externalId: context.season.id,
                      externalScope: context.binding.external_competition_id,
                    },
                    {
                      role: 'home_team',
                      externalId: match.homeTeamKey,
                      externalScope: context.binding.external_competition_id,
                    },
                    {
                      role: 'away_team',
                      externalId: match.awayTeamKey,
                      externalScope: context.binding.external_competition_id,
                    },
                    ...(sourceStage
                      ? [
                          {
                            role: 'stage' as const,
                            externalId: sourceStage.id,
                            externalScope: `${context.binding.external_competition_id}:${context.season.id}`,
                          },
                        ]
                      : []),
                    ...(snapshot.stage.matchday === null || !sourceStage
                      ? []
                      : [
                          {
                            role: 'round' as const,
                            externalId: `${sourceStage.id}:${snapshot.stage.matchday}`,
                            externalScope: `${context.binding.external_competition_id}:${context.season.id}`,
                          },
                        ]),
                  ],
                  `${context.binding.external_competition_id}:${context.season.id}`,
                ),
              );
            if (selected.has('results') && match.score !== null) {
              const scoreCandidate =
                candidate && candidate.home_score !== null && candidate.away_score !== null
                  ? `${candidate.home_score}-${candidate.away_score}`
                  : null;
              const incoming = `${match.score.home}-${match.score.away}`;
              add(
                this.#item(
                  'results',
                  `${match.matchKey}:result`,
                  `${home} ${incoming} ${away}`,
                  scoreCandidate === incoming ? 'unchanged' : scoreCandidate ? 'conflict' : 'new',
                  candidate ? { id: candidate.id, label: `${candidate.home} vs ${candidate.away}` } : null,
                  [
                    {
                      name: 'score',
                      localValue: scoreCandidate,
                      incomingValue: incoming,
                      baselineValue: null,
                      protected: Boolean(scoreCandidate && scoreCandidate !== incoming),
                    },
                  ],
                  scoreCandidate && scoreCandidate !== incoming
                    ? ['El marcador local se conserva como valor predeterminado.']
                    : [],
                  [
                    {
                      role: 'match',
                      externalId: match.matchKey,
                      externalScope: `${context.binding.external_competition_id}:${context.season.id}`,
                    },
                  ],
                  `${context.binding.external_competition_id}:${context.season.id}`,
                ),
              );
            }
          }
        if (selected.has('results') && !snapshot.matches.some((match) => match.score !== null)) {
          addWarning(
            'Una o más selecciones no contienen resultados finalizados disponibles.',
            snapshot.matches.length
              ? snapshot.matches.map((match) => match.matchKey)
              : (sourceStage?.id ?? snapshot.stage.name),
          );
        }
      }
    }
    if (!wantsSnapshot) {
      onStage?.('fetching', 'completed');
      onStage?.('normalizing', 'started');
      onStage?.('normalizing', 'completed');
      onStage?.('comparing', 'started');
    }
    checkCancelled();
    onStage?.('comparing', 'completed');
    onStage?.('preparing_preview', 'started');
    const now = this.#container.clock.now();
    const retrievedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + TTL_MS).toISOString();
    const localFingerprint = this.#fingerprint(competitionId, input.destinationSeasonId ?? null);
    const summary: ImportPreview['summary'] = {
      new: records.filter((item) => item.operation === 'new').length,
      changed: records.filter((item) => item.operation === 'changed').length,
      unchanged: records.filter((item) => item.operation === 'unchanged').length,
      conflicts: records.filter((item) => item.operation === 'conflict').length,
      invalid: records.filter((item) => item.operation === 'invalid').length,
      skipped: records.filter((item) => item.operation === 'skipped').length,
    };
    const preview: ImportPreview = {
      previewId: randomUUID(),
      competitionId,
      providerKey: context.binding.provider_key,
      providerName: context.source.descriptor.name,
      externalCompetitionName: context.binding.external_competition_name,
      externalSeasonId: context.season.id,
      externalSeasonLabel: context.season.label,
      destinationSeasonId: input.destinationSeasonId ?? null,
      retrievedAt,
      expiresAt,
      snapshotHash: sha(JSON.stringify(records)),
      localFingerprint,
      stale: false,
      resources: input.resources,
      summary,
      capabilities,
      warnings: this.#groupWarnings(warningOccurrences),
      items: records,
    };
    const checked = ImportPreviewSchema.safeParse(preview);
    if (!checked.success)
      throw new ContractResponseError(
        'ImportPreviewResponse',
        checked.error.issues.slice(0, 12).map((issue) => `preview.${issue.path.join('.')}`),
      );
    checkCancelled();
    const writeStartedAt = performance.now();
    this.#db.transaction(() => {
      this.#db.prepare('DELETE FROM competition_import_previews WHERE expires_at <= ?').run([retrievedAt]);
      this.#db
        .prepare(
          `INSERT INTO competition_import_previews
        (id, competition_id, binding_id, provider_key, external_season_id, destination_season_id, resources_json, preview_json, retrieved_at, expires_at, snapshot_hash, local_fingerprint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run([
          preview.previewId,
          competitionId,
          context.binding.id,
          context.binding.provider_key,
          context.season.id,
          preview.destinationSeasonId,
          JSON.stringify(input.resources),
          JSON.stringify(preview),
          retrievedAt,
          expiresAt,
          preview.snapshotHash,
          localFingerprint,
        ]);
    });
    const writeMs = performance.now() - writeStartedAt;
    onStage?.('preparing_preview', 'completed');
    this.#container.logger.info(
      {
        operation: 'competition-import-preview',
        selectionReads,
        providerWaitMs: Math.round(providerWaitMs),
        processingMs: Math.round(performance.now() - startedAt - providerWaitMs - writeMs),
        snapshotWriteMs: Math.round(writeMs),
        totalMs: Math.round(performance.now() - startedAt),
      },
      'import preview prepared',
    );
    return preview;
  }

  get(competitionId: string, previewId: string): ImportPreview {
    const row = this.#db
      .prepare<{
        preview_json: string;
        expires_at: string;
        local_fingerprint: string;
        destination_season_id: string | null;
        binding_id: string;
      }>(
        'SELECT preview_json, expires_at, local_fingerprint, destination_season_id, binding_id FROM competition_import_previews WHERE id = ? AND competition_id = ?',
      )
      .get([previewId, competitionId]);
    if (!row) throw new HttpProblem(404, 'NOT_FOUND', 'No encontramos esta vista previa.');
    if (Date.parse(row.expires_at) <= this.#container.clock.now().getTime()) {
      this.#db
        .prepare('DELETE FROM competition_import_previews WHERE id = ? AND competition_id = ?')
        .run([previewId, competitionId]);
      throw new HttpProblem(
        410,
        'IMPORT_PREVIEW_EXPIRED',
        'La vista previa expiró. Consulta nuevamente los datos del proveedor.',
      );
    }
    const stored = JSON.parse(row.preview_json) as Omit<ImportPreview, 'warnings' | 'items'> & {
      warnings: Array<ImportPreview['warnings'][number] | string>;
      items: Array<ImportPreviewItem & { relationships?: ImportPreviewItem['relationships'] }>;
    };
    // Retain previews created by the previous contract until their normal 30-minute expiry.
    const preview: ImportPreview = {
      ...stored,
      warnings: stored.warnings.every((warning) => typeof warning !== 'string')
        ? (stored.warnings as ImportPreview['warnings'])
        : this.#groupWarnings((stored.warnings as string[]).map((message) => ({ message }))),
      items: stored.items.map((item) => ({ ...item, relationships: item.relationships ?? [] })),
    };
    const currentFingerprint = this.#fingerprint(competitionId, row.destination_season_id);
    const activeBinding = this.#db
      .prepare<{ id: string }>(
        "SELECT id FROM competition_provider_bindings WHERE competition_id = ? AND status = 'active'",
      )
      .get([competitionId]);
    const bindingChanged = activeBinding?.id !== row.binding_id;
    return {
      ...preview,
      stale: currentFingerprint !== row.local_fingerprint || bindingChanged,
      warnings: bindingChanged
        ? [
            ...preview.warnings,
            this.#groupWarnings([{ message: 'La fuente vinculada cambió después de generar esta vista previa.' }])[0]!,
          ]
        : preview.warnings,
    };
  }

  #context(competitionId: string) {
    const competition = this.#db
      .prepare<{ id: string }>('SELECT id FROM competitions WHERE id = ?')
      .get([competitionId]);
    if (!competition) throw new HttpProblem(404, 'NOT_FOUND', 'No encontramos esta competición.');
    const binding = this.#db
      .prepare<BindingRow>(
        "SELECT id, competition_id, provider_key, source_id, external_competition_id, external_competition_name FROM competition_provider_bindings WHERE competition_id = ? AND status = 'active'",
      )
      .get([competitionId]);
    if (!binding)
      throw new HttpProblem(409, 'PROVIDER_UNAVAILABLE', 'Vincula una competición externa antes de consultar datos.');
    const provider = this.#container.sources.providerCatalog.find((item) => item.key === binding.provider_key);
    if (!provider) throw new HttpProblem(503, 'PROVIDER_UNAVAILABLE', 'El proveedor vinculado ya no está registrado.');
    const source = this.#container.sources
      .list()
      .find(
        (item) =>
          item.descriptor.id === binding.source_id &&
          item.descriptor.adapter === binding.provider_key &&
          item.descriptor.enabled,
      );
    if (!source)
      throw new HttpProblem(
        503,
        'PROVIDER_UNAVAILABLE',
        'El proveedor vinculado no está disponible en esta configuración.',
      );
    return { binding, source };
  }

  async #competitionRef(source: IngestionSource, binding: BindingRow, signal?: AbortSignal): Promise<SourceRef> {
    const listing = await source.listCompetitions(this.#contextForProvider(signal));
    const match = listing.items.find((item) => item.localKey === binding.external_competition_id);
    if (!match)
      throw new HttpProblem(
        409,
        'PROVIDER_UNAVAILABLE',
        'La competición externa vinculada ya no está en el catálogo del proveedor.',
      );
    return match.ref;
  }

  async #seasonContext(competitionId: string, externalSeasonId: string, signal?: AbortSignal) {
    const { binding, source } = this.#context(competitionId);
    const competitionRef = await this.#competitionRef(source, binding, signal);
    const listing = await source.listSeasons(competitionRef, this.#contextForProvider(signal));
    const season = listing.items.find((item) => item.id === externalSeasonId);
    if (!season)
      throw new HttpProblem(404, 'NOT_FOUND', 'La temporada externa ya no está disponible para esta competición.');
    return { binding, source, competitionRef, season };
  }

  #contextForProvider(signal?: AbortSignal) {
    return { signal: signal ?? new AbortController().signal, purpose: 'consultation' as const };
  }
  #capabilities(stages: readonly SourceStage[]) {
    const availableStages = stages.length > 0;
    const hasSelections = stages.some((stage) => this.#selectionRefs(stage).length > 0);
    const supportsParticipants = stages.some((stage) => stage.standings === 'expected');
    return RESOURCE_ORDER.map((resource) => {
      const available =
        resource === 'season' ||
        (resource === 'stages' && availableStages) ||
        (resource === 'rounds' && stages.some((stage) => stage.matchdays.length > 0)) ||
        (['teams', 'matches', 'results'].includes(resource) && hasSelections) ||
        (resource === 'participants' && supportsParticipants);
      const reason = available
        ? null
        : resource === 'participants'
          ? 'El proveedor no anuncia tabla de participantes para esta temporada.'
          : resource === 'rounds'
            ? 'La temporada no contiene jornadas numeradas disponibles.'
            : 'El proveedor no ofrece este recurso para la temporada seleccionada.';
      return { resource, available, reason };
    });
  }
  #selectionRefs(stage: SourceStage): SourceRef[] {
    // Prefer round-scoped reads so every returned match retains its round context. Use a whole-stage read only
    // when the source does not expose matchdays for that stage.
    return stage.matchdays.length > 0
      ? stage.matchdays.map((day) => day.ref)
      : stage.wholeStageRef
        ? [stage.wholeStageRef]
        : [];
  }
  #item(
    resource: ImportResource,
    externalId: string,
    title: string,
    operation: ImportPreviewItem['operation'],
    localCandidate: LocalCandidate | null,
    fields: ImportPreviewItem['fields'],
    warnings: string[],
    relationships: ImportPreviewItem['relationships'] = [],
    externalScope: string | null = null,
  ): ImportPreviewItem {
    return {
      resource,
      externalId,
      externalScope,
      title:
        title
          .replace(/[^\p{L}\p{M}\p{N} .'&()/-]+/gu, ' ')
          .trim()
          .slice(0, 80) || 'Registro externo',
      operation,
      localCandidate,
      relationships,
      fields,
      warnings,
    };
  }
  #groupWarnings(occurrences: readonly { message: string; affectedExternalId?: string }[]) {
    const grouped = new Map<string, { message: string; count: number; affectedExternalIds: Set<string> }>();
    for (const occurrence of occurrences) {
      const current = grouped.get(occurrence.message) ?? {
        message: occurrence.message,
        count: 0,
        affectedExternalIds: new Set<string>(),
      };
      current.count += 1;
      if (occurrence.affectedExternalId) current.affectedExternalIds.add(occurrence.affectedExternalId);
      grouped.set(occurrence.message, current);
    }
    return [...grouped.values()].slice(0, 100).map(({ message, count, affectedExternalIds }) => {
      const normalized = message.toLocaleLowerCase('es');
      const severity = normalized.includes('no se pudo consultar')
        ? ('error' as const)
        : normalized.includes('posible coincidencia') || normalized.includes('coincidencia por nombre')
          ? ('conflict' as const)
          : normalized.includes('no contienen resultados') || normalized.includes('se limitaron las consultas')
            ? ('info' as const)
            : ('warning' as const);
      return {
        code: `PREVIEW_${sha(message).slice(0, 12).toUpperCase()}`,
        severity,
        message,
        occurrenceCount: count,
        affectedExternalIds: [...affectedExternalIds].slice(0, 500),
      };
    });
  }
  #localStatus(status: string): 'scheduled' | 'in_progress' | 'finished' | 'postponed' | 'cancelled' | null {
    switch (status) {
      case 'scheduled':
        return 'scheduled';
      case 'in_play':
        return 'in_progress';
      case 'finished':
        return 'finished';
      case 'postponed':
        return 'postponed';
      case 'cancelled':
        return 'cancelled';
      default:
        return null;
    }
  }
  #fingerprint(competitionId: string, seasonId: string | null): string {
    const seasons = this.#db
      .prepare('SELECT id, label, created_at FROM competition_seasons WHERE competition_id = ? ORDER BY id')
      .all([competitionId]);
    const teams = this.#db.prepare('SELECT id, name, region, updated_at FROM managed_teams ORDER BY id').all();
    const competitionTeams = this.#db
      .prepare('SELECT team_id, associated_at FROM competition_teams WHERE competition_id = ? ORDER BY team_id')
      .all([competitionId]);
    const scoped = seasonId
      ? {
          season: this.#db
            .prepare('SELECT id, label FROM competition_seasons WHERE id=? AND competition_id=?')
            .get([seasonId, competitionId]),
          participants: this.#db
            .prepare('SELECT team_id, joined_at FROM season_participants WHERE season_id=? ORDER BY team_id')
            .all([seasonId]),
          stages: this.#db
            .prepare('SELECT id, name, display_order FROM competition_stages WHERE season_id=? ORDER BY id')
            .all([seasonId]),
          rounds: this.#db
            .prepare('SELECT id, stage_id, name, display_order FROM competition_rounds WHERE season_id=? ORDER BY id')
            .all([seasonId]),
          matches: this.#db
            .prepare(
              'SELECT id, stage_id, round_id, home_team_id, away_team_id, kickoff_at, status FROM competition_matches WHERE season_id=? ORDER BY id',
            )
            .all([seasonId]),
          results: this.#db
            .prepare(
              'SELECT match_id, home_score, away_score FROM match_results WHERE match_id IN (SELECT id FROM competition_matches WHERE season_id=?) ORDER BY match_id',
            )
            .all([seasonId]),
          history: this.#db
            .prepare(
              'SELECT h.match_id, h.change_type, h.status, h.home_score, h.away_score, h.kickoff_at, h.recorded_at FROM match_result_history h WHERE h.match_id IN (SELECT id FROM competition_matches WHERE season_id=?) ORDER BY h.match_id, h.recorded_at, h.id',
            )
            .all([seasonId]),
        }
      : null;
    return sha(JSON.stringify({ seasons, teams, competitionTeams, scoped }));
  }
}
