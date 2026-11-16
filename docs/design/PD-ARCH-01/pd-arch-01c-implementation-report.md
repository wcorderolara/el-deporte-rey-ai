# PD-ARCH-01C — Calendar & Results

**Status:** Product Owner accepted and technically closed 2026-11-03. **Branch:** `work/PD-ARCH-01C`, based on accepted PD-ARCH-01B checkpoint `4087eec`. **Closeout commit:** `8616832` (`feat(competitions): complete calendar and results management`).

## Blocking review correction (2026-10-30)

- Root cause: the operator database had applied `0005_calendar_and_results.sql`, whose schema includes score columns on `competition_matches` and no `match_results` table. `SQLiteCompetitionCalendarRepository.listMatches` joined `match_results`, so SQLite returned `no such table: match_results`. The same schema drift affected current-match and result-history queries/writes (`match_result_history.stage_id` and `round_id` did not yet exist).
- Fix: preserve applied `0005`; add `0006_match_results.sql` to create the result table, backfill existing scores, and add nullable historical phase/round references. Keep the legacy score columns synchronized to maintain the `0005` CHECK constraints.
- Regression coverage: migrated `GET /matches` empty and all four supported calendar contexts, 0005-to-0006 score/history migration, and an empty season detail page.

## Calendar navigation refinement

- Reorganized season navigation into a compact season summary, participants page, calendar catalog, phase detail, round detail, and a separate ungrouped-match view. Match cards and result/history controls remain the existing implementation and only render for the selected context.
- Added `PATCH /competitions/{competitionId}/seasons/{seasonId}/stages/{stageId}` and `PATCH /competitions/{competitionId}/seasons/{seasonId}/rounds/{roundId}` to rename existing calendar groups. Names are normalized and uniqueness is checked within the same season/context; IDs, match links, scores and ordering are preserved.

## Calendar return path and round reassignment

- Calendar detail breadcrumbs now include a direct `Volver al calendario` link and the current phase/round context. Reassignment keeps the round detail open and updates its URL to the selected phase; clearing the phase returns to the season-level round route.
- Extended the existing round `PATCH` to accept `stageId` (including `null`). Reassignment is transactional: attached matches are safely detached and restored under the new composite phase/round key, with original IDs, kickoff, scores and previous history preserved. Each context change appends a schedule-history snapshot. Duplicate round/match contexts and phases from another season are rejected.

## Phase detail UX refinement

- Phase-level matches remain unchanged in storage. Existing records are available in a collapsed “Partidos existentes asociados directamente a esta fase” disclosure; open a match card and use “Cambiar programación” to move it to a round. New matches are created from round details, not directly from a phase.
- The phase round catalog uses icon-only table/cards controls and a trash action with explanatory tooltip. Delete remains server-guarded and does not cascade. Calendar return links are presented as links with a left-arrow icon.

## Delivered

- Additive SQLite migration `0005_calendar_and_results.sql` adds optional competition stages, season-level or stage-level rounds, season-owned matches, current result pairs and append-only match change history.
- Supports all four shapes: direct season matches, direct season rounds, stage-only matches and stage rounds. No artificial stage or consecutive numeric round is imposed.
- Matches require two distinct participants from their season. Stage/round relationships are checked against the same season and parent stage.
- Manual result changes accept any status transition. State remains independent from the optional paired score; score corrections preserve prior snapshots.
- Reprogramming updates the same match identity and adds a history entry. Exact duplicate prevention only applies to a non-null kickoff in the same season, orientation and calendar context.
- Prevents unlinking a team participant while matches reference it (`TEAM_IN_USE`). No sports provider, AI, content generation, approval or export behavior changed.

## API and manual routes

UI: `/competitions/:competitionId/seasons/:seasonId` — participant, optional phase/round and calendar administration.

API under `/api/v1`:

- Stages: `GET/POST .../stages`, `GET .../stages/{stageId}`.
- Direct rounds: `GET/POST .../rounds`, `GET .../rounds/{roundId}`.
- Stage rounds: `GET/POST .../stages/{stageId}/rounds`.
- Matches: `GET/POST .../matches`, `GET .../matches/{matchId}`, `PATCH .../matches/{matchId}/schedule`.
- Results: `POST .../matches/{matchId}/result`, `GET .../matches/{matchId}/result-history`.

## Verification

- TypeScript typecheck, targeted ESLint and production build: passed.
- Calendar/membership/migration integration tests: 25 passed.
- Calendar UI component tests: 6 passed.
- Targeted OpenAPI/served contract tests: 721 passed.
- `git diff --check`: passed.
- No E2E or automated visual tests run (PD-UI-21).

## Limits and review notes

- Stages, rounds and matches can be created/listed/read, but renaming or deleting those records is not included. Matches are retained; corrections and schedule changes are versioned in history.
- The UI uses the browser's local timezone for `datetime-local` entry and sends an ISO instant. There is no separate competition timezone setting.
- Integration/synchronization, standings, automatic scheduling and content generation remain outside 01C.

## Manual acceptance scenarios

1. Create a match directly in a season with no stage or round; verify it shows `vs` and no score.
2. Create a season-level round and schedule a match in it.
3. Create a phase and a named round within it; schedule a match there.
4. Record a finished `0–0`, then correct it and check that both snapshots remain in history.
5. Reschedule a match and verify its identity/result remain while the new schedule is added to history.
6. Try self-play, a non-participant team, mismatched phase/round and an exact duplicate kickoff; each must be refused.
7. Try removing a participant already used in a match; verify the page shows the actionable `TEAM_IN_USE` error.

## Competition teams and season participants refinement (2026-11-02)

- Added the distinct `CompetitionTeam` relation. `Team` remains the reusable global identity; `CompetitionTeam` associates it with a competition; `SeasonParticipant` enrolls it in one season.
- Added additive migration `0007_competition_teams.sql`. It backfills historical participant links using the parent season and existing join timestamp; it does not rebuild teams, participants, matches or results.
- Added `GET/POST /competitions/{competitionId}/teams` for listing/associating catalog teams or atomically creating and associating a team. Added `POST /competitions/{competitionId}/seasons/{seasonId}/participants/batch`; validation and inserts run in a single transaction.
- The legacy single-participant POST remains compatible and creates the competition association atomically when an older caller enrolls a global catalog team. New UI uses only competition-associated teams and the batch endpoint.
- Added `/competitions/:competitionId/teams`. `/participants` now lists competition teams, selects multiple new participants in one modal action, and retains the existing unlink guard for teams used by matches.
- Verification: typecheck, targeted ESLint, production build and `git diff --check` passed; 26 persistence/integration, 107 OpenAPI/served-contract and 11 competition UI tests passed. No E2E or automated visual tests were run.

## Competition team administration refinement (2026-11-02)

- Added `PATCH /teams/{teamId}` to rename or update region on the reusable global Team. It preserves its ID and all `CompetitionTeam` and `SeasonParticipant` links; normalized uniqueness rejects duplicates.
- Added `DELETE /competitions/{competitionId}/teams/{teamId}` to remove only the competition relation. The operation is transactional and returns `COMPETITION_TEAM_IN_USE` while the team participates in any season of that competition.
- `/competitions/:competitionId/teams` now supports searchable catalog reuse, new-team creation with duplicate suggestion (explicit reuse, no merging), global team editing, and guarded unlinking. The lower “Ver temporadas” action is removed; the contextual competition link and breadcrumbs remain.
- Existing catalog Team records are never deleted by this flow. Matches/results are not cascaded or changed.
- Final verification on the current uncommitted branch: typecheck, targeted ESLint, production build and `git diff --check` passed; 28 persistence/integration tests, 107 OpenAPI/served-contract tests and 12 competition UI tests passed. No E2E or visual automation was run (PD-UI-21).

## Independent match status and score refinement (2026-11-03)

- Root cause: the calendar service rejected transitions such as `cancelled → in_progress`; the old route mapped that policy rejection to `VERSION_CONFLICT`. The service also required scores only for `finished`/`in_progress`, the React form hid score inputs for other states, and migration 0005's applied `CHECK` tied score nullability to status.
- The result endpoint remains `POST /api/v1/competitions/{competitionId}/seasons/{seasonId}/matches/{matchId}/result`. Status and scores are now independently editable; omitted score fields preserve existing values, explicit `null/null` clears them, and `0/0` remains a recorded score. Unchanged payloads do not append history.
- Added migration `0008_independent_match_state_and_scores.sql`, rebuilding the match, result and history tables transactionally to relax only status/score coupling while preserving IDs, score/history rows, foreign keys, indexes and history ordering.
- Verification for this refinement: typecheck, targeted ESLint, production build and `git diff --check` passed; 27 calendar/persistence integration tests and 16 affected competition UI tests passed. No E2E or browser automation was run.

## Technical closeout verification (2026-11-03)

- Passed: typecheck, ESLint + Prettier, production build, `git diff --check`, all 42 integration test files (531 tests), all 7 contract test files (1,290 tests), and all 120 unit files (2,197 tests).
- The UI-05A export boundary test was corrected to include its existing `GET /exports/:exportId/download` route in the exact registered-route inventory. Its no-network, no-provider, and no-publishing assertions remain intact.
- No E2E or browser automation was run (PD-UI-21).
