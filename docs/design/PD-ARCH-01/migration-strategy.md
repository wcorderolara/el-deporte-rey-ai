# Migration Strategy

## Compatibility rule

All schema work is additive and shipped as new numbered migrations. Never edit applied migration files. Do not delete, rewrite or bulk-classify project, import, approval or export data. Preserve existing contract behavior and snapshots.

## First migration

`0003_competitions.sql` creates an independent local `competitions` table with UUID identity, validated name, timestamps and a recency index. It does not add a FK or reinterpret existing `competition_id` values. Startup migration is transactional and existing tables/data are untouched.

## PD-ARCH-01B migration

`0004_seasons_and_participants.sql` is additive and references only the managed `competitions` root:

- `competition_seasons` stores season labels plus an internal normalized identity key and enforces `UNIQUE(competition_id, normalized_label)`.
- `managed_teams` is a global local catalogue. Its exact normalized name+region pair is unique; the optional region allows same-named clubs in distinct locations. No fuzzy matching or provider ID is used.
- `season_participants` has a composite `(season_id, team_id)` primary key and FKs to both parent tables. Deleting a membership does not delete a team. No season/team deletion operation is introduced in this slice.

The pre-existing WI-1 `teams` and `team_aliases` tables are not renamed, repurposed or copied: they represent per-run verification identities. Import slug tables also remain separate. No project, import, approval or export row is changed.

## PD-ARCH-01C migration

`0005_calendar_and_results.sql` adds the competition-local calendar tables and constraints:

- `competition_stages` belongs to a season; no stage is required or fabricated.
- `competition_rounds` belongs to a season and optionally one stage. Partial unique indexes scope normalized labels to either the season's direct rounds or one stage's rounds.
- `competition_matches` always belongs to a season; stage and round references are nullable. Composite season references, participant foreign keys, same-context validation, self-play checks and exact non-null-kickoff duplicate prevention protect valid references.
- `competition_matches` includes a nullable current score pair with paired-value and status checks.
- `match_result_history` records creation, programming, status, result and correction snapshots. In the applied `0005` schema, historical stage/round references are not separate columns.

### PD-ARCH-01C compatibility correction

The `0005` migration already applied to existing operator databases stores nullable scores on `competition_matches` and does not have `match_results` or phase/round columns on `match_result_history`. The initial 01C repository implementation had advanced beyond that applied schema, causing match reads to fail with SQLite `no such table: match_results` and writes/history reads to reference missing columns. Keep `0005` unchanged. `0006_match_results.sql` additively creates the normalized current-result table, copies any existing score pairs from `competition_matches`, and adds nullable history context columns. Repository result writes keep the legacy score columns synchronized to satisfy the constraints already installed by `0005`. The migration runs transactionally and does not touch the operator database until normal application startup; tests exercise it only against temporary databases.

`TEAM_IN_USE` prevents unlinking a season participant after matches reference the team. Existing competition, season, participant and WI-1/WI-2 records remain unchanged. No migration depends on an external provider.

### Competition team membership refinement

Migration `0007_competition_teams.sql` adds the `competition_teams` junction keyed by `(competition_id, team_id)` with foreign keys to the existing competition and global team catalogue. It backfills each historical season participant to the competition that owns its season, using the existing participant timestamp as the earliest known association time. Existing Team IDs, participant rows, matches, results and history remain untouched. An insert trigger ensures a season participant has a matching competition/team association. The legacy single-participant endpoint creates that association atomically when needed for compatibility; the new batch endpoint accepts only already-associated teams and validates the complete request before any inserts.

Team edits update the existing global `managed_teams` row in place, retaining its primary key and all competition/season relations; normalized name+region uniqueness remains the duplicate guard. Competition unlinking deletes only the matching `competition_teams` row and is refused while any season under that competition has the team enrolled. The FK and participant guard trigger preserve data integrity; no cascade is used.

### Independent manual match state and score

The state/score `CHECK` clauses in the already-applied `0005` schema prevent manual changes such as `cancelled → in_progress`, scores on a scheduled match, or a finished match with no score. `0008_independent_match_state_and_scores.sql` transactionally rebuilds the match table and its two dependent result/history tables, preserving IDs, rows, indexes, history row order and foreign keys while removing only the coupling between status and score. Status values, paired-score nullability, nonnegative integer scores, season/team/stage/round references and duplicate-match rules remain enforced. Existing migration files are unchanged.

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

There is no incompatible dependency detected for 01A or 01B. The API and UI must be deployed from a build containing migrations 0003 and 0004; both apply non-destructively at server startup.
