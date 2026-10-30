# Migration Strategy

## Compatibility rule

All schema work is additive and shipped as new numbered migrations. Never edit applied migration files. Do not delete, rewrite or bulk-classify project, import, approval or export data. Preserve existing contract behavior and snapshots.

## First migration

`0003_competitions.sql` creates an independent local `competitions` table with UUID identity, validated name, timestamps and a recency index. It does not add a FK or reinterpret existing `competition_id` values. Startup migration is transactional and existing tables/data are untouched.

## Later project relationship

When competition-based content creation is ready, add a nullable FK column or an explicit association for newly linked workflows. Keep it null for legacy projects. If historical mapping is offered, map only when both the catalogue/source identity and selection snapshot establish an unambiguous managed competition; otherwise leave unlinked and preserve all original snapshots. Any mapping should be dry-run/reportable and reversible before applying.

Manual import IDs are not automatically mapped to managed competition UUIDs. Existing import constraints, original-file hashes, supersession, and version history remain unchanged. Add a reviewed source-binding key that relates a managed competition to a source reference; do not use a text slug as a cross-domain FK.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Same display name refers to different competitions | UUID identity; name is presentation only. Later add optional season/region/sport identifiers and duplicate review. |
| Catalogue ID is assumed to be local ID | Separate column/types and APIs; keep provider reference behind a source binding. |
| Legacy data is linked incorrectly | No automatic migration; nullable association and operator-reviewed mapping. |
| Manual corrections are overwritten | Field-level override and sync conflict rules before introducing sync. |
| Existing content behavior changes unexpectedly | Preserve Project APIs and runner until a separately scoped integration slice. |
| Persistent DB upgrade fails partway | Existing migration runner wraps each migration and migration history atomically; verify FK and integrity in targeted tests. |

There is no incompatible dependency detected for 01A. The only rollout consideration is that the API and UI must be deployed from a build containing migration 0003, which applies non-destructively at server startup.
