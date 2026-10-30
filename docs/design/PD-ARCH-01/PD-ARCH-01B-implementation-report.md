# PD-ARCH-01B — Seasons & Participants

**Status:** accepted by Product Owner on 2026-10-30. **Branch:** `work/PD-ARCH-01B`, based on accepted 01A commit `14dfb1f`. **Checkpoint commit:** recorded after acceptance.

## Delivered

- Additive migration `0004_seasons_and_participants.sql` adds competition-owned seasons, a reusable local team catalogue and season/team membership with foreign keys and unique constraints.
- Seasons preserve operator labels such as `2026/27` and `2027`; normalized labels cannot duplicate within one competition.
- Team identity is local and provider-neutral. An exact normalized name plus optional region cannot be duplicated; similar names remain distinct. A team can participate in several seasons.
- Removing membership deletes only the join row, never the team.
- API contract and Zod schemas cover season create/list/detail, team create/list/detail and participant list/add/remove. Duplicate cases have explicit conflict codes.
- Competition detail now lists/creates seasons. Season detail lists participants, associates existing teams, creates local teams and unlinks participants.
- Existing WI-1 `teams` verification identity table and project/review/approval/export data remain untouched.

## Routes

- UI: `/competitions`, `/competitions/:competitionId`, `/competitions/:competitionId/seasons/:seasonId`.
- API: `/api/v1/competitions/{competitionId}/seasons[/{seasonId}]`, `/api/v1/teams[/{teamId}]`, and `/api/v1/competitions/{competitionId}/seasons/{seasonId}/participants[/{teamId}]`.

## Verification

- `npm run typecheck` — passed.
- Targeted ESLint on the affected competition, API, contract and UI files — passed.
- Competition UI component tests — 4 passed.
- Competition and migration persistence tests — 24 passed.
- Targeted API/OpenAPI contract tests — 617 passed.
- `npm run build` — passed for server, web and contracts.
- `git diff --check` — passed.
- No E2E or automated visual tests were run (PD-UI-21).

## Known limits

Season/team editing and deletion are not offered. Teams are created or selected from the season workspace. Duplicate prevention is exact after Unicode compatibility, case and whitespace normalization; the system does not guess that similar names refer to the same club.
