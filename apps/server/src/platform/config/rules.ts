/**
 * Startup rules across settings and documents (architecture.md sections 5.1 and 15.2; contracts/provider-ports.md
 * section 1.2; OD-20, OD-24, OD-27, AD-37, AD-38; R-266).
 *
 * Each rule returns issues that name the setting, the source or the link, with fixed problem text; a configured value
 * other than a source or link ID (which are slugs) is never echoed. Lookups keyed by configured values use `Map`
 * (T11H-F07).
 */
import type { CatalogueLink } from './catalogue.js';
import type { ConfigIssue } from './errors.js';
import type { RawSource } from './schema.js';
import type { DataMode, SourceConfig } from './types.js';

const SOURCES = 'providers.sports.sources';

/** Origin of an `https:` URL without user information, or null for anything else. */
export function httpsOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.hostname === '') {
    return null;
  }
  return url.origin;
}

/** The `baseUrl` member of adapter options, read as an own property only. */
export function optionBaseUrl(options: Readonly<Record<string, unknown>>): unknown {
  return Object.hasOwn(options, 'baseUrl') ? options['baseUrl'] : undefined;
}

function defaultPermission(mode: DataMode): SourceConfig['publicationPermission'] {
  return mode === 'LIVE_DATA' ? 'unconfirmed' : 'not_applicable';
}

/**
 * Applies the source defaults and the per-source rules: publication permission and decision (PD-18, AD-38), the
 * accepted MANUAL_DATA refusal (R-071), and the `https:` base URL of LIVE_DATA sources (OD-20).
 */
export function resolveSources(raw: readonly RawSource[], issues: ConfigIssue[]): SourceConfig[] {
  return raw.map((source, index) => {
    const at = `${SOURCES}[${String(index)}]`;
    const permission = source.publicationPermission ?? defaultPermission(source.mode);
    const decision = source.publicationPermissionDecision ?? null;

    if (source.mode === 'MANUAL_DATA' && source.accepted) {
      issues.push({
        setting: `${at}.accepted`,
        problem: `must be false for the MANUAL_DATA source '${source.id}': manual data is never an accepted source (R-071)`,
      });
    }

    if (source.mode === 'LIVE_DATA') {
      if (permission === 'not_applicable') {
        issues.push({
          setting: `${at}.publicationPermission`,
          problem: `of the LIVE_DATA source '${source.id}' must be unconfirmed or confirmed`,
        });
      }
      if (permission === 'confirmed' && decision === null) {
        issues.push({
          setting: `${at}.publicationPermissionDecision`,
          problem:
            `is required for the LIVE_DATA source '${source.id}' because its publicationPermission is confirmed: ` +
            'confirmed needs the recorded Product Owner decision on the provider written permission (PD-18)',
        });
      }
      if (permission === 'unconfirmed' && decision !== null) {
        issues.push({
          setting: `${at}.publicationPermissionDecision`,
          problem: `is refused for the source '${source.id}' because its publicationPermission is unconfirmed`,
        });
      }
    } else {
      if (permission !== 'not_applicable') {
        issues.push({
          setting: `${at}.publicationPermission`,
          problem: `of the ${source.mode} source '${source.id}' must be not_applicable`,
        });
      }
      if (decision !== null) {
        issues.push({
          setting: `${at}.publicationPermissionDecision`,
          problem: `is refused on the ${source.mode} source '${source.id}'`,
        });
      }
    }

    const baseUrl = optionBaseUrl(source.options);
    if (source.mode === 'LIVE_DATA' && baseUrl === undefined) {
      issues.push({
        setting: `${at}.options.baseUrl`,
        problem: `is required for the LIVE_DATA source '${source.id}' and must be an https: URL`,
      });
    } else if (baseUrl !== undefined && httpsOrigin(baseUrl) === null) {
      issues.push({
        setting: `${at}.options.baseUrl`,
        problem: `of the source '${source.id}' must be an https: URL without user information`,
      });
    }

    return {
      id: source.id,
      name: source.name,
      mode: source.mode,
      enabled: source.enabled,
      role: source.role,
      accepted: source.accepted,
      independenceGroup: source.independenceGroup ?? source.id,
      officialPublication: source.officialPublication,
      publicationPermission: permission,
      publicationPermissionDecision: decision,
      adapter: source.adapter,
      options: source.options,
    };
  });
}

/**
 * Rules over the whole source list: unique IDs, at least one enabled primary source (OD-20), and source independence
 * (OD-24, T11H-F13): two enabled sources with the same adapter kind and the same `options.baseUrl` origin must share
 * one independence group, because one upstream counts once.
 */
export function checkSourceList(sources: readonly SourceConfig[], issues: ConfigIssue[]): void {
  const firstIndexById = new Map<string, number>();
  sources.forEach((source, index) => {
    const first = firstIndexById.get(source.id);
    if (first === undefined) {
      firstIndexById.set(source.id, index);
    } else {
      issues.push({
        setting: `${SOURCES}[${String(index)}].id`,
        problem: `duplicates the source ID '${source.id}' of ${SOURCES}[${String(first)}]`,
      });
    }
  });

  if (!sources.some((source) => source.enabled && source.role === 'primary')) {
    issues.push({ setting: SOURCES, problem: 'must contain at least one enabled source with role primary' });
  }

  const byUpstream = new Map<string, SourceConfig>();
  for (const source of sources) {
    const origin = source.enabled ? httpsOrigin(optionBaseUrl(source.options)) : null;
    if (origin === null) {
      continue;
    }
    const upstream = `${source.adapter}\u0000${origin}`;
    const earlier = byUpstream.get(upstream);
    if (earlier === undefined) {
      byUpstream.set(upstream, source);
    } else if (earlier.independenceGroup !== source.independenceGroup) {
      issues.push({
        setting: SOURCES,
        problem:
          `'${earlier.id}' and '${source.id}' use the same adapter kind and base URL origin but different ` +
          'independence groups; sources sharing an upstream must share one independenceGroup (OD-24)',
      });
    }
  }
}

/**
 * Rules of the catalogue links against the configured sources (architecture.md section 15.2; OD-24, AD-37, AD-38):
 * unique link IDs; every binding names a configured source, once per link; a source competition is bound by one link
 * only; stage aliases only for bound sources; a link binds at least one source; a link never binds a DEMO_DATA source
 * together with a LIVE_DATA or MANUAL_DATA source; a link marked `noAcceptedPublicSource` binds MANUAL_DATA sources
 * only and no accepted source.
 */
export function checkCatalogueLinks(
  links: readonly CatalogueLink[],
  sources: readonly SourceConfig[],
  issues: ConfigIssue[],
): void {
  const sourceById = new Map<string, SourceConfig>(sources.map((source) => [source.id, source]));
  const linkIndexById = new Map<string, number>();
  const linkByBinding = new Map<string, string>();

  links.forEach((link, index) => {
    const at = `catalogue.links[${String(index)}]`;
    const named = `the link '${link.id}'`;

    const first = linkIndexById.get(link.id);
    if (first === undefined) {
      linkIndexById.set(link.id, index);
    } else {
      issues.push({ setting: `${at}.id`, problem: `duplicates the link ID of catalogue.links[${String(first)}]` });
    }

    if (link.bindings.length === 0) {
      issues.push({
        setting: at,
        problem: link.noAcceptedPublicSource
          ? `${named} is marked noAcceptedPublicSource and must bind at least one MANUAL_DATA source`
          : `${named} must bind at least one source`,
      });
    }

    const modes = new Map<DataMode, string>();
    const boundSources = new Set<string>();
    link.bindings.forEach((binding, bindingIndex) => {
      const source = sourceById.get(binding.sourceId);
      if (source === undefined) {
        issues.push({
          setting: `${at}.bindings[${String(bindingIndex)}].sourceId`,
          problem: `of ${named} names the source '${binding.sourceId}', which is not configured`,
        });
        return;
      }
      if (boundSources.has(source.id)) {
        issues.push({
          setting: `${at}.bindings[${String(bindingIndex)}].sourceId`,
          problem: `binds the source '${source.id}' to ${named} twice`,
        });
      }
      boundSources.add(source.id);
      if (!modes.has(source.mode)) {
        modes.set(source.mode, source.id);
      }

      const key = `${binding.sourceId}\u0000${binding.competitionRef}`;
      const otherLink = linkByBinding.get(key);
      if (otherLink !== undefined && otherLink !== link.id) {
        issues.push({
          setting: `${at}.bindings[${String(bindingIndex)}]`,
          problem: `binds a competition of the source '${source.id}' that the link '${otherLink}' already binds`,
        });
      } else {
        linkByBinding.set(key, link.id);
      }

      if (link.noAcceptedPublicSource && (source.mode !== 'MANUAL_DATA' || source.accepted)) {
        issues.push({
          setting: at,
          problem:
            `${named} is marked noAcceptedPublicSource and must bind MANUAL_DATA sources only, never a LIVE_DATA, ` +
            `DEMO_DATA or accepted source; it binds the ${source.mode} source '${source.id}' (PD-17, AD-38)`,
        });
      }
    });

    const demo = modes.get('DEMO_DATA');
    const real = modes.get('LIVE_DATA') ?? modes.get('MANUAL_DATA');
    if (demo !== undefined && real !== undefined) {
      issues.push({
        setting: at,
        problem:
          `${named} binds the DEMO_DATA source '${demo}' together with the LIVE_DATA or MANUAL_DATA source ` +
          `'${real}'; synthetic data never confirms real facts (OD-24)`,
      });
    }

    for (const sourceId of link.stageAliases.keys()) {
      if (!boundSources.has(sourceId)) {
        issues.push({
          setting: `${at}.stageAliases`,
          problem: `of ${named} names the source '${sourceId}', which the link does not bind`,
        });
      }
    }
  });
}
