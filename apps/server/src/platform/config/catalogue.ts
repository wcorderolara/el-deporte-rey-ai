/**
 * Catalogue configuration (config/catalogue.json; architecture.md section 15.2; AD-23, AD-38).
 *
 * Optional links group the same competition across sources, mark reference scenarios, may restrict the catalogue
 * (`restrictToLinks`) or a link's stages (`selectableStages`), give stage aliases for counterpart resolution, and may
 * mark a competition as having no accepted public source (`noAcceptedPublicSource`, PD-17). The catalogue service
 * (T21) merges the sources' listings with these links; nothing here names a competition or a provider.
 *
 * Every lookup keyed by a configured or file-supplied value (link IDs, source IDs, competition references, stage IDs)
 * uses a `Map` (T11H-F07).
 */
import type { RawLink } from './schema.js';

export interface CatalogueBinding {
  readonly sourceId: string;
  /** Opaque competition reference, interpreted only by the source's adapter. */
  readonly competitionRef: string;
}

export interface CatalogueLink {
  /** Catalogue ID of the linked competition (slug). */
  readonly id: string;
  readonly name: string;
  /** Initial validation scenario, listed first. */
  readonly reference: boolean;
  readonly bindings: readonly CatalogueBinding[];
  /** Canonical stage IDs per source and source stage ID. */
  readonly stageAliases: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Stage restriction (unused in committed configurations, PD-20); null when absent. */
  readonly selectableStages: readonly string[] | null;
  /** Competition configured as having no accepted public source (PD-17, AD-38). */
  readonly noAcceptedPublicSource: boolean;
}

function bindingKey(sourceId: string, competitionRef: string): string {
  return `${sourceId}\u0000${competitionRef}`;
}

/** Validated, read-only catalogue links with `Map` lookups. */
export class CatalogueConfig {
  readonly links: readonly CatalogueLink[];
  /** Only linked competitions are offered (unused in committed configurations, PD-19). */
  readonly restrictToLinks: boolean;
  readonly #byId: ReadonlyMap<string, CatalogueLink>;
  readonly #bySource: ReadonlyMap<string, readonly CatalogueLink[]>;
  readonly #byBinding: ReadonlyMap<string, CatalogueLink>;

  constructor(links: readonly CatalogueLink[], restrictToLinks: boolean) {
    this.links = Object.freeze([...links]);
    this.restrictToLinks = restrictToLinks;
    const byId = new Map<string, CatalogueLink>();
    const bySource = new Map<string, CatalogueLink[]>();
    const byBinding = new Map<string, CatalogueLink>();
    for (const link of this.links) {
      byId.set(link.id, link);
      for (const binding of link.bindings) {
        const list = bySource.get(binding.sourceId) ?? [];
        if (!list.includes(link)) {
          list.push(link);
        }
        bySource.set(binding.sourceId, list);
        byBinding.set(bindingKey(binding.sourceId, binding.competitionRef), link);
      }
    }
    this.#byId = byId;
    this.#bySource = new Map([...bySource].map(([sourceId, list]) => [sourceId, Object.freeze(list)]));
    this.#byBinding = byBinding;
    Object.freeze(this);
  }

  /** An empty catalogue configuration: no links, no restriction. */
  static empty(): CatalogueConfig {
    return new CatalogueConfig([], false);
  }

  /** The link with this catalogue ID. */
  getLink(id: string): CatalogueLink | undefined {
    return this.#byId.get(id);
  }

  /** The links that bind this source, in file order. */
  linksOfSource(sourceId: string): readonly CatalogueLink[] {
    return this.#bySource.get(sourceId) ?? [];
  }

  /** The link that binds this source's competition reference. */
  linkOfBinding(sourceId: string, competitionRef: string): CatalogueLink | undefined {
    return this.#byBinding.get(bindingKey(sourceId, competitionRef));
  }

  /** The canonical stage ID of a source's stage within a link, when the link gives an alias for it. */
  stageAlias(linkId: string, sourceId: string, stageId: string): string | undefined {
    return this.#byId.get(linkId)?.stageAliases.get(sourceId)?.get(stageId);
  }
}

/** Builds the frozen link records from validated raw links. */
export function toCatalogueLinks(rawLinks: readonly RawLink[]): CatalogueLink[] {
  return rawLinks.map((raw) =>
    Object.freeze({
      id: raw.id,
      name: raw.name,
      reference: raw.reference,
      bindings: Object.freeze(
        raw.bindings.map((binding) =>
          Object.freeze({ sourceId: binding.sourceId, competitionRef: binding.competitionRef }),
        ),
      ),
      stageAliases: new Map(raw.stageAliases ?? []) as ReadonlyMap<string, ReadonlyMap<string, string>>,
      selectableStages: raw.selectableStages === undefined ? null : Object.freeze([...raw.selectableStages]),
      noAcceptedPublicSource: raw.noAcceptedPublicSource,
    }),
  );
}
