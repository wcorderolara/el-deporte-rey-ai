# football-data.org capability findings (T53 probe run)

- Run conditions (PD-16, SC-08): the run took place on the Product Owner's single-user workstation, with a token the Product Owner stated to be a free-plan token, placed by the Product Owner in `.env.local` (mode 0600) of the T53 worktree and never shown in a conversation; the probe was started by the Product Owner from a terminal on 2026-10-28; no purchase or upgrade.
- Token handling: the marker scan with `--require-token` over this file and the console log printed `real token checked: yes` and 0 findings (evidence `T53-marker-scan-real.txt`); the console log and `.env.local` were deleted afterwards.
- The section below is the probe's own output, unchanged. Notes for T14 and OD-22 follow it.

- Probe run started: 2026-10-28T18:14:53.361Z (UTC)
- Outcome: completed
- Requests sent: 30 of at most 30; refused by the request cap: 0
- Configured reference competition codes: CL
- Origin: https://api.football-data.org (the only origin contacted)
- Anything not observed below is UNVERIFIED and not promised (R-259).

## Competitions listed

Resource GET /competitions, retrieved 2026-10-28T18:14:54.067Z; one detail request per candidate, at most 12 (GET /competitions/:code).

| Code | Name | Area | Reference | Readable with the token | Seasons reported | Detail retrieved |
|---|---|---|---|---|---|---|
| CL | UEFA Champions League | Europe | yes | yes | 47 | 2026-10-28T18:14:54.266Z |
| BSA | Campeonato Brasileiro Série A | Brazil | no | yes | 10 | 2026-10-28T18:14:54.451Z |
| ELC | Championship | England | no | yes | 10 | 2026-10-28T18:14:54.645Z |
| PL | Premier League | England | no | yes | 128 | 2026-10-28T18:14:54.847Z |
| EC | European Championship | Europe | no | yes | 17 | 2026-10-28T18:14:55.043Z |
| FL1 | Ligue 1 | France | no | yes | 83 | 2026-10-28T18:14:55.228Z |
| BL1 | Bundesliga | Germany | no | yes | 64 | 2026-10-28T18:14:55.420Z |
| SA | Serie A | Italy | no | yes | 95 | 2026-10-28T18:14:55.614Z |
| DED | Eredivisie | Netherlands | no | yes | 71 | 2026-10-28T18:14:55.810Z |
| PPL | Primeira Liga | Portugal | no | yes | 78 | 2026-10-28T18:16:54.439Z |
| CLI | Copa Libertadores | South America | no | yes | 6 | 2026-10-28T18:16:54.646Z |
| PD | Primera Division | Spain | no | yes | 95 | 2026-10-28T18:16:54.859Z |
| WC | FIFA World Cup | World | no | not checked (UNVERIFIED) | - | - |

## Coverage per competition

### CL (UEFA Champions League), reference

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T18:16:55.174Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | LEAGUE_STAGE | 8 (1 to 8) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Stage discovery, season 2025/26 (GET /competitions/:code/matches?season, retrieved 2026-10-28T18:16:56.070Z): 6 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | LEAGUE_STAGE | 8 (1 to 8) | no | expected |
  | PLAYOFFS | 2 (1 to 2) | no | expected |
  | LAST_16 | 2 (1 to 2) | no | expected |
  | QUARTER_FINALS | 2 (1 to 2) | no | expected |
  | SEMI_FINALS | 2 (1 to 2) | no | expected |
  | FINAL | none | yes | unknown |

  Stages other than the table stage carrying matchday numbers: 0
- Filter stage LEAGUE_STAGE, matchday 1: failed (invalid)
- Filter stage FINAL as a whole (retrieved 2026-10-28T18:16:56.298Z): matches 1; standings not available (not_provided_for_stage)
  - Freshness: matches with kickoff more than 3 hours old: 1 (finished 1)

### BSA (Campeonato Brasileiro Série A), candidate

- Season probed: 2026 (current: yes; start year 2026)
- Stage discovery, season 2026 (GET /competitions/:code/matches?season, retrieved 2026-10-28T18:16:57.160Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 38 (1 to 38) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Filter stage REGULAR_SEASON, matchday 1 (retrieved 2026-10-28T18:16:57.389Z): matches 10; standings available (20 rows)
  - Freshness: matches with kickoff more than 3 hours old: 10 (finished 10)

### ELC (Championship), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery (current season): failed (invalid)

### PL (Premier League), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T18:17:56.164Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 38 (1 to 38) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Filter stage REGULAR_SEASON, matchday 1 (retrieved 2026-10-28T18:17:56.389Z): matches 10; standings available (20 rows)
  - Freshness: matches with kickoff more than 3 hours old: 10 (finished 10)

### EC (European Championship), candidate

- Season probed: 2024 (current: yes; start year 2024)
- Stage discovery, season 2024 (GET /competitions/:code/matches?season, retrieved 2026-10-28T18:17:56.863Z): 5 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | GROUP_STAGE | 3 (1 to 3) | no | expected |
  | LAST_16 | 1 (4 to 4) | no | unknown |
  | QUARTER_FINALS | 1 (5 to 5) | no | unknown |
  | SEMI_FINALS | 1 (6 to 6) | no | unknown |
  | FINAL | 1 (7 to 7) | no | unknown |

  Stages other than the table stage carrying matchday numbers: 4
- Filter stage GROUP_STAGE, matchday 1 (retrieved 2026-10-28T18:17:57.147Z): matches 12; standings not available (not_provided_by_source)
  - Freshness: matches with kickoff more than 3 hours old: 12 (finished 12)

### FL1 (Ligue 1), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T18:17:57.818Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 34 (1 to 34) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Matchday and stage filters: not probed (UNVERIFIED)

## Field presence of the mapped fields

Counts of items in which the field is present and not null, over every response of the kind.

### GET /competitions

| Field | Presence | Present | Of |
|---|---|---|---|
| competitions[].id | always | 13 | 13 |
| competitions[].code | always | 13 | 13 |
| competitions[].name | always | 13 | 13 |
| competitions[].area.name | always | 13 | 13 |

Dropped keys (names only): `competitions[].area.code`, `competitions[].area.flag`, `competitions[].area.id`, `competitions[].currentSeason`, `competitions[].emblem`, `competitions[].lastUpdated`, `competitions[].numberOfAvailableSeasons`, `competitions[].plan`, `competitions[].type`, `count`, `filters`

### GET /competitions/:code

| Field | Presence | Present | Of |
|---|---|---|---|
| id | always | 12 | 12 |
| code | always | 12 | 12 |
| name | always | 12 | 12 |
| currentSeason | always | 12 | 12 |
| currentSeason.currentMatchday | always | 12 | 12 |
| seasons[].startDate | always | 704 | 704 |
| seasons[].endDate | always | 704 | 704 |

Dropped keys (names only): `area`, `currentSeason.winner`, `emblem`, `lastUpdated`, `seasons[].winner`, `type`

### GET /competitions/:code/matches?season

| Field | Presence | Present | Of |
|---|---|---|---|
| competition.name | always | 6 | 6 |
| matches[].id | always | 1450 | 1450 |
| matches[].utcDate | always | 1450 | 1450 |
| matches[].status | always | 1450 | 1450 |
| matches[].stage | always | 1450 | 1450 |
| matches[].matchday | sometimes | 1449 | 1450 |

Dropped keys (names only): `competition.code`, `competition.emblem`, `competition.id`, `competition.type`, `filters`, `matches[].area`, `matches[].awayTeam.crest`, `matches[].competition`, `matches[].group`, `matches[].homeTeam.crest`, `matches[].lastUpdated`, `matches[].odds`, `matches[].referees`, `matches[].score.duration`, `matches[].score.extraTime`, `matches[].score.halfTime`, `matches[].score.penalties`, `matches[].score.regularTime`, `matches[].score.winner`, `matches[].season`, `resultSet`

### GET /competitions/:code/matches?season&matchday or &stage

| Field | Presence | Present | Of |
|---|---|---|---|
| competition.name | always | 5 | 5 |
| matches[].id | always | 51 | 51 |
| matches[].utcDate | always | 51 | 51 |
| matches[].status | always | 51 | 51 |
| matches[].stage | always | 51 | 51 |
| matches[].matchday | sometimes | 50 | 51 |
| matches[].homeTeam.id | always | 51 | 51 |
| matches[].homeTeam.name | always | 51 | 51 |
| matches[].homeTeam.shortName | always | 51 | 51 |
| matches[].homeTeam.tla | always | 51 | 51 |
| matches[].awayTeam.id | always | 51 | 51 |
| matches[].awayTeam.name | always | 51 | 51 |
| matches[].awayTeam.shortName | always | 51 | 51 |
| matches[].awayTeam.tla | always | 51 | 51 |
| matches[].score.fullTime.home | always | 51 | 51 |
| matches[].score.fullTime.away | always | 51 | 51 |

Dropped keys (names only): `competition.code`, `competition.emblem`, `competition.id`, `competition.type`, `filters`, `matches[].area`, `matches[].awayTeam.crest`, `matches[].competition`, `matches[].group`, `matches[].homeTeam.crest`, `matches[].lastUpdated`, `matches[].odds`, `matches[].referees`, `matches[].score.duration`, `matches[].score.extraTime`, `matches[].score.halfTime`, `matches[].score.penalties`, `matches[].score.regularTime`, `matches[].score.winner`, `matches[].season`, `resultSet`

### GET /competitions/:code/standings?season&matchday

| Field | Presence | Present | Of |
|---|---|---|---|
| standings[].stage | always | 9 | 9 |
| standings[].type | always | 9 | 9 |
| standings[].group | never | 0 | 9 |
| standings[].table[].position | always | 228 | 228 |
| standings[].table[].team.id | always | 228 | 228 |
| standings[].table[].team.name | always | 228 | 228 |
| standings[].table[].playedGames | always | 228 | 228 |
| standings[].table[].won | always | 228 | 228 |
| standings[].table[].draw | always | 228 | 228 |
| standings[].table[].lost | always | 228 | 228 |
| standings[].table[].points | always | 228 | 228 |
| standings[].table[].goalsFor | always | 228 | 228 |
| standings[].table[].goalsAgainst | always | 228 | 228 |
| standings[].table[].goalDifference | always | 228 | 228 |

Dropped keys (names only): `area`, `competition.code`, `competition.emblem`, `competition.id`, `competition.type`, `filters`, `season`, `standings[].table[].form`, `standings[].table[].team.crest`

TOTAL tables seen: 3

## Response headers and statuses

- X-API-Version values: v4
- X-RequestsAvailable observed: not observed (UNVERIFIED)
- X-RequestCounter-Reset observed (seconds): 57 to 60 (last 57, 29 responses)
- Statuses: 200 x27, 429 x1, invalid x1, 404 x1
- 429 responses: 1
- 403 classification evidence (presence booleans only, never the value):
  - X-Authenticated-Client present on 2xx responses: yes
  - X-Authenticated-Client present on 403 responses: no 403 observed (UNVERIFIED)
  - Same value on every response that carried it: yes

## Response sizes

| Resource | Responses | Largest decoded body (bytes) | Above 512 KiB |
|---|---|---|---|
| GET /competitions | 1 | 5647 | no |
| GET /competitions/:code | 13 | 22641 | no |
| GET /competitions/:code/matches?season | 6 | 384639 | no |
| GET /competitions/:code/matches?season&matchday or &stage | 5 | 18748 | no |
| GET /competitions/:code/standings?season&matchday | 4 | 28268 | no |

## Orchestrator notes for T14 and OD-22 (observations only, not decisions)

- Readable with the free-plan token: 12 of the 13 listed competitions (WC not checked within the 30-request cap), including the reference competition CL; the other 12 are candidates for the second LIVE_DATA demonstration competition (OD-22). PL and BSA returned a full matchday selection with matches, full-time scores and standings (20 rows); EC returned matches but no standings for its group stage (`not_provided_by_source`).
- CL 2026/27 shows only `LEAGUE_STAGE`, matchdays 1 to 8. The combined filter stage `LEAGUE_STAGE` plus matchday 1 failed with the classification `invalid`, as did the ELC stage discovery; the status counts show one `invalid` and one 404. The probe does not show which request gave which; T14 must establish whether matchday selection for CL works with the matchday filter alone before CL is relied on as a LIVE_DATA demonstration.
- Knockout stages (CL 2025/26 `PLAYOFFS` to `SEMI_FINALS`) carry matchday numbers 1 to 2; `FINAL` carries none and is selectable as a whole; `matches[].matchday` is absent on 1 of 1450 matches (the CL final).
- Rate limit: one 429 within 30 requests at the 10-per-minute pacing; `X-RequestCounter-Reset` observed 57 to 60 seconds; `X-RequestsAvailable` not observed; whether the counter is per token is UNVERIFIED (NV-10).
- `X-Authenticated-Client` present on every 2xx response with one value (presence only, value never recorded); no 403 observed, so the 403 classification evidence stays UNVERIFIED (NV-8).
- Largest decoded body 384639 bytes (season matches of one competition), below the 512 KiB cap (NV-7, Q8).
- Freshness: every probed match with kickoff more than 3 hours old was finished.
