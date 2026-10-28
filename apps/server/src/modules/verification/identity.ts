/**
 * Team identity (architecture.md section 7.2; AD-18, AD-38 item 4, OD-12, R-426; T10-A1-06, T11H-F07).
 *
 * - Identity maps are optional configuration files `config/team-identities/<competitionId>-<seasonId>.json`. A map
 *   lists canonical team IDs, the official name and the allowed aliases (the pinned names), and per source the
 *   source's team key. The file is looked up by the exact project competition and season IDs (both slugs), so the
 *   name is never parsed.
 * - Matching uses the map first. A team without a map entry is matched by exact equality of normalized names
 *   (Unicode NFC, case-folded, diacritics removed, punctuation and the map's `ignoreTokens` removed). Canonical IDs
 *   of teams without a map entry are slugs derived deterministically from the competition, the season and the
 *   normalized name, so the same team gets the same ID in every run.
 * - Pinned mode (a project of a competition configured as having no accepted public source, AD-38): only the map is
 *   used, the source's team key must be in it and the source's name must be one of the pinned names; any other team
 *   is unmatched, and every team is unmatched without a map.
 * - A source key without an identity gets a placeholder slug derived from the source ID and the key, so every value
 *   fits the contract `Slug` even when the source's own key does not (T10-A1-06).
 * - Every lookup keyed by a source, a team key or a name uses `Map` or `Set` (T11H-F07).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { SlugSchema, SourceIdSchema, TeamNameSchema } from '@edr/contracts';
import { z } from 'zod';

import { StageFailure, issuePointer } from '../../workflow/index.js';

/** Directory of the identity maps, relative to the project root. */
export const TEAM_IDENTITIES_DIRECTORY = join('config', 'team-identities');

/** Largest identity map file read (bytes). */
export const MAX_IDENTITY_MAP_BYTES = 256 * 1024;

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const IdentityMapSchema = z
  .strictObject({
    competitionId: SlugSchema,
    seasonId: SlugSchema,
    ignoreTokens: z.array(z.string().min(1).max(32)).max(50).default([]),
    teams: z
      .array(
        z.strictObject({
          teamId: SlugSchema,
          officialName: TeamNameSchema,
          aliases: z.array(TeamNameSchema).max(32).default([]),
          sourceKeys: z
            .array(z.strictObject({ sourceId: SourceIdSchema, teamKey: z.string().min(1).max(128) }))
            .max(20),
        }),
      )
      .max(512),
  })
  .superRefine((map, ctx) => {
    const ids = new Set<string>();
    const keys = new Set<string>();
    map.teams.forEach((team, index) => {
      if (ids.has(team.teamId)) {
        ctx.addIssue({ code: 'custom', path: ['teams', index, 'teamId'], message: 'Duplicate team ID' });
      }
      ids.add(team.teamId);
      team.sourceKeys.forEach((entry, keyIndex) => {
        const key = sourceKeyId(entry.sourceId, entry.teamKey);
        if (keys.has(key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['teams', index, 'sourceKeys', keyIndex],
            message: 'A source team key is mapped twice',
          });
        }
        keys.add(key);
      });
    });
  });

export type IdentityMapDocument = z.infer<typeof IdentityMapSchema>;

function sourceKeyId(sourceId: string, teamKey: string): string {
  return `${sourceId}\u0000${teamKey}`;
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Normalized name for identity matching: NFC, diacritics removed, case-folded, punctuation removed, ignored tokens
 * removed, single spaces.
 */
export function normalizeTeamName(name: string, ignoreTokens: ReadonlySet<string> = new Set()): string {
  const tokens = name
    .normalize('NFC')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((token) => token !== '' && !ignoreTokens.has(token));
  return tokens.join(' ');
}

/** The ignore tokens of a map, normalized the same way as names. */
function normalizedIgnoreTokens(tokens: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (const token of tokens) {
    for (const part of normalizeTeamName(token).split(' ')) {
      if (part !== '') {
        result.add(part);
      }
    }
  }
  return result;
}

/** ASCII slug of a normalized name (may be empty for names without Latin letters or digits). */
function asciiSlug(text: string, maxLength: number): string {
  const slug = text
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug;
}

/** Canonical team ID derived from the competition, the season and the normalized name (fits `Slug`). */
export function derivedTeamId(competitionId: string, seasonId: string, normalizedName: string): string {
  const hash = sha256Hex(`${competitionId}\u0000${seasonId}\u0000${normalizedName}`).slice(0, 12);
  const base = asciiSlug(normalizedName, 40);
  return base === '' ? `t-${hash}` : `${base}-${hash}`;
}

/** Placeholder ID of a source team key without identity (fits `Slug`; T10-A1-06). */
export function placeholderTeamId(sourceId: string, teamKey: string): string {
  return `x-${sha256Hex(`${sourceId}\u0000${teamKey}`).slice(0, 20)}`;
}

/** An identity map with `Map` lookups. */
export class IdentityMap {
  readonly document: IdentityMapDocument;
  readonly ignoreTokens: ReadonlySet<string>;
  readonly #bySourceKey: ReadonlyMap<string, IdentityMapDocument['teams'][number]>;
  /** Normalized official names and aliases to the team IDs that carry them. */
  readonly #byName: ReadonlyMap<string, ReadonlySet<string>>;

  constructor(document: IdentityMapDocument) {
    this.document = document;
    this.ignoreTokens = normalizedIgnoreTokens(document.ignoreTokens);
    const bySourceKey = new Map<string, IdentityMapDocument['teams'][number]>();
    const byName = new Map<string, Set<string>>();
    for (const team of document.teams) {
      for (const entry of team.sourceKeys) {
        bySourceKey.set(sourceKeyId(entry.sourceId, entry.teamKey), team);
      }
      for (const name of [team.officialName, ...team.aliases]) {
        const normalized = normalizeTeamName(name, this.ignoreTokens);
        const set = byName.get(normalized) ?? new Set<string>();
        set.add(team.teamId);
        byName.set(normalized, set);
      }
    }
    this.#bySourceKey = bySourceKey;
    this.#byName = byName;
  }

  entryOf(sourceId: string, teamKey: string): IdentityMapDocument['teams'][number] | undefined {
    return this.#bySourceKey.get(sourceKeyId(sourceId, teamKey));
  }

  teamIdsOfName(normalizedName: string): ReadonlySet<string> {
    return this.#byName.get(normalizedName) ?? new Set();
  }
}

/**
 * Reads the identity map of a competition and season, or null when there is none. An invalid or unreadable map fails
 * the stage with `invalid` and a pointer of field names only (never a value or a file path).
 */
export function loadIdentityMap(rootDir: string, competitionId: string, seasonId: string): IdentityMapDocument | null {
  if (!SLUG.test(competitionId) || !SLUG.test(seasonId)) {
    return null;
  }
  const file = join(rootDir, TEAM_IDENTITIES_DIRECTORY, `${competitionId}-${seasonId}.json`);
  if (!existsSync(file)) {
    return null;
  }
  let parsed: unknown;
  try {
    const stats = statSync(file);
    if (!stats.isFile() || stats.size > MAX_IDENTITY_MAP_BYTES) {
      throw new StageFailure('invalid', { path: '/' });
    }
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    if (error instanceof StageFailure) {
      throw error;
    }
    throw new StageFailure('invalid', { path: '/' });
  }
  const result = IdentityMapSchema.safeParse(parsed);
  if (!result.success) {
    throw new StageFailure('invalid', { path: issuePointer(result.error) });
  }
  if (result.data.competitionId !== competitionId || result.data.seasonId !== seasonId) {
    throw new StageFailure('invalid', { path: '/competitionId' });
  }
  return result.data;
}

// ---------------------------------------------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------------------------------------------

export interface IdentityTeamInput {
  readonly teamKey: string;
  readonly name: string;
  readonly aliases: readonly string[];
}

export interface IdentitySourceInput {
  readonly sourceId: string;
  readonly teams: readonly IdentityTeamInput[];
}

export interface IdentityInput {
  readonly competitionId: string;
  readonly seasonId: string;
  /** Every source whose snapshot is used; the project's source first. */
  readonly sources: readonly IdentitySourceInput[];
  /**
   * Sources whose teams must all be present for a team to be matched: the project's source and every other source
   * whose observations count for the project (accepted, OD-24). With one identity source no cross-source check applies.
   */
  readonly identitySourceIds: ReadonlySet<string>;
  readonly map: IdentityMap | null;
  /** Pinned names: the map only, no name fallback (AD-38 item 4). */
  readonly pinned: boolean;
}

export interface TeamIdentity {
  readonly teamId: string;
  /** False for placeholders and for teams absent from another identity source. */
  readonly matched: boolean;
}

export interface IdentityResult {
  /** Per source ID, per source team key. */
  readonly bySource: ReadonlyMap<string, ReadonlyMap<string, TeamIdentity>>;
  /** Canonical team IDs that are unmatched. */
  readonly unmatched: ReadonlySet<string>;
}

/** Resolves the canonical team ID of every team of every source (pure). */
export function resolveIdentities(input: IdentityInput): IdentityResult {
  const { map } = input;
  const ignore = map?.ignoreTokens ?? new Set<string>();
  const unmatched = new Set<string>();
  const bySource = new Map<string, Map<string, TeamIdentity>>();

  for (const source of input.sources) {
    const candidates = new Map<string, string>();
    const placeholders = new Set<string>();
    for (const team of source.teams) {
      const placeholder = placeholderTeamId(source.sourceId, team.teamKey);
      const entry = map?.entryOf(source.sourceId, team.teamKey);
      if (input.pinned) {
        const pinnedNames = new Set(
          entry === undefined ? [] : [entry.officialName, ...entry.aliases].map((n) => n.normalize('NFC')),
        );
        if (entry !== undefined && pinnedNames.has(team.name.normalize('NFC'))) {
          candidates.set(team.teamKey, entry.teamId);
        } else {
          candidates.set(team.teamKey, placeholder);
          placeholders.add(team.teamKey);
        }
        continue;
      }
      if (entry !== undefined) {
        candidates.set(team.teamKey, entry.teamId);
        continue;
      }
      const normalized = normalizeTeamName(team.name, ignore);
      if (normalized === '') {
        candidates.set(team.teamKey, placeholder);
        placeholders.add(team.teamKey);
        continue;
      }
      const mapped = map?.teamIdsOfName(normalized) ?? new Set<string>();
      const [only] = [...mapped];
      candidates.set(
        team.teamKey,
        mapped.size === 1 && only !== undefined ? only : derivedTeamId(input.competitionId, input.seasonId, normalized),
      );
    }

    // Two keys of one source with one identity: neither can be identified.
    const keysById = new Map<string, string[]>();
    for (const [teamKey, teamId] of candidates) {
      const keys = keysById.get(teamId) ?? [];
      keys.push(teamKey);
      keysById.set(teamId, keys);
    }
    const identities = new Map<string, TeamIdentity>();
    for (const [teamKey, teamId] of candidates) {
      const ambiguous = (keysById.get(teamId)?.length ?? 0) > 1;
      if (ambiguous || placeholders.has(teamKey)) {
        const id = placeholderTeamId(source.sourceId, teamKey);
        identities.set(teamKey, { teamId: id, matched: false });
        unmatched.add(id);
      } else {
        identities.set(teamKey, { teamId, matched: true });
      }
    }
    bySource.set(source.sourceId, identities);
  }

  // Cross-source check: a team is matched only when every identity source that returned teams has it.
  const identitySources = input.sources.filter((source) => input.identitySourceIds.has(source.sourceId));
  if (identitySources.length > 1) {
    const presence = new Map<string, number>();
    for (const source of identitySources) {
      const seen = new Set<string>();
      for (const identity of bySource.get(source.sourceId)?.values() ?? []) {
        if (identity.matched) {
          seen.add(identity.teamId);
        }
      }
      for (const id of seen) {
        presence.set(id, (presence.get(id) ?? 0) + 1);
      }
    }
    for (const [sourceId, identities] of bySource) {
      for (const [teamKey, identity] of identities) {
        if (identity.matched && (presence.get(identity.teamId) ?? 0) < identitySources.length) {
          identities.set(teamKey, { teamId: identity.teamId, matched: false });
          if (input.identitySourceIds.has(sourceId)) {
            unmatched.add(identity.teamId);
          }
        }
      }
    }
  }

  return { bySource, unmatched };
}
