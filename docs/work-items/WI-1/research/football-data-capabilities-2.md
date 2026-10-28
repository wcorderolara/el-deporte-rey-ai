# football-data.org capability findings, second run (T61 probe run, PD-24)

- Run conditions (PD-16, PD-24, SC-08; T60 conditions C1 to C8): the run took place on the Product Owner's single-user workstation with a token the Product Owner stated to be a free-plan token, placed by the Product Owner in `.env.local` of the T61 worktree (set to mode 0600 by the Orchestrator before the run finished) and never shown in a conversation; the probe was started by the Product Owner from a terminal on 2026-10-28 with `--candidates CL,ELC,PD,BL1,SA,FL1`; probe, adapter, validation, egress client, security checks, live configuration and probe script unchanged since the reviewed commit 3313782 (C1); no purchase or upgrade.
- Token handling: the `--require-token` marker scan over the research folder and the console log ran before anything was read (23 files, `real token checked: yes`, findings 0; evidence `T61-marker-scan-real.txt`); the console log was deleted unread and `.env.local` deleted (C3, C4). The "Dropped keys" lines hold only ordinary provider field names and the only diagnostic line has a reviewed format (C7).
- The section below is the probe's own output, unchanged. Notes for T62 follow it.

- Probe run started: 2026-10-28T21:36:40.536Z (UTC)
- Outcome: completed
- Requests sent: 27 of at most 30; refused by the request cap: 0
- Configured reference competition codes: CL
- Named candidate codes (--candidates): CL, ELC, PD, BL1, SA, FL1
- Origin: https://api.football-data.org (the only origin contacted)
- Anything not observed below is UNVERIFIED and not promised (R-259).

## Competitions listed

Resource GET /competitions, retrieved 2026-10-28T21:36:41.244Z; one detail request per candidate, at most 12 (GET /competitions/:code).

| Code | Name | Area | Reference | Readable with the token | Seasons reported | Detail retrieved |
|---|---|---|---|---|---|---|
| CL | UEFA Champions League | Europe | yes | yes | 47 | 2026-10-28T21:36:41.453Z |
| BSA | Campeonato Brasileiro Série A | Brazil | no | not checked (UNVERIFIED) | - | - |
| ELC | Championship | England | no | yes | 10 | 2026-10-28T21:36:41.644Z |
| PL | Premier League | England | no | not checked (UNVERIFIED) | - | - |
| EC | European Championship | Europe | no | not checked (UNVERIFIED) | - | - |
| FL1 | Ligue 1 | France | no | yes | 83 | 2026-10-28T21:36:42.420Z |
| BL1 | Bundesliga | Germany | no | yes | 64 | 2026-10-28T21:36:42.045Z |
| SA | Serie A | Italy | no | yes | 95 | 2026-10-28T21:36:42.238Z |
| DED | Eredivisie | Netherlands | no | not checked (UNVERIFIED) | - | - |
| PPL | Primeira Liga | Portugal | no | not checked (UNVERIFIED) | - | - |
| CLI | Copa Libertadores | South America | no | not checked (UNVERIFIED) | - | - |
| PD | Primera Division | Spain | no | yes | 95 | 2026-10-28T21:36:41.836Z |
| WC | FIFA World Cup | World | no | not checked (UNVERIFIED) | - | - |

## Coverage per competition

### CL (UEFA Champions League), reference

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T21:36:42.727Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | LEAGUE_STAGE | 8 (1 to 8) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Stage discovery, season 2025/26 (GET /competitions/:code/matches?season, retrieved 2026-10-28T21:37:41.279Z): 6 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | LEAGUE_STAGE | 8 (1 to 8) | no | expected |
  | PLAYOFFS | 2 (1 to 2) | no | unknown |
  | LAST_16 | 2 (1 to 2) | no | unknown |
  | QUARTER_FINALS | 2 (1 to 2) | no | unknown |
  | SEMI_FINALS | 2 (1 to 2) | no | unknown |
  | FINAL | none | yes | unknown |

  Stages other than the table stage carrying matchday numbers: 4
- Filter stage LEAGUE_STAGE, matchday 1: failed (invalid; domain validation on selection, path /teams/29/name)
- Filter stage FINAL as a whole (retrieved 2026-10-28T21:37:41.479Z): matches 1; standings not available (not_provided_for_stage)
  - Freshness: matches with kickoff more than 3 hours old: 1 (finished 1)

### ELC (Championship), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T21:37:42.308Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 46 (1 to 46) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Filter stage REGULAR_SEASON, matchday 1 (retrieved 2026-10-28T21:37:42.542Z): matches 12; standings available (24 rows)
  - Freshness: matches with kickoff more than 3 hours old: 12 (finished 12)

### PD (Primera Division), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T21:37:43.570Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 38 (1 to 38) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Filter stage REGULAR_SEASON, matchday 1 (retrieved 2026-10-28T21:37:43.787Z): matches 10; standings available (20 rows)
  - Freshness: matches with kickoff more than 3 hours old: 10 (finished 10)

### BL1 (Bundesliga), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T21:37:44.649Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 34 (1 to 34) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Filter stage REGULAR_SEASON, matchday 1 (retrieved 2026-10-28T21:37:44.858Z): matches 9; standings available (18 rows)
  - Freshness: matches with kickoff more than 3 hours old: 9 (finished 9)

### SA (Serie A), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T21:38:42.147Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 38 (1 to 38) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Filter stage REGULAR_SEASON, matchday 1 (retrieved 2026-10-28T21:38:42.457Z): matches 10; standings available (20 rows)
  - Freshness: matches with kickoff more than 3 hours old: 10 (finished 10)

### FL1 (Ligue 1), candidate

- Season probed: 2026/27 (current: yes; start year 2026)
- Stage discovery, season 2026/27 (GET /competitions/:code/matches?season, retrieved 2026-10-28T21:38:43.176Z): 1 stages

  | Stage value | Matchday numbers | Selectable as a whole | Standings |
  |---|---|---|---|
  | REGULAR_SEASON | 34 (1 to 34) | no | expected |

  Stages other than the table stage carrying matchday numbers: not observed (UNVERIFIED)
- Filter stage REGULAR_SEASON, matchday 1 (retrieved 2026-10-28T21:38:43.398Z): matches 9; standings available (18 rows)
  - Freshness: matches with kickoff more than 3 hours old: 9 (finished 9)

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
| id | always | 6 | 6 |
| code | always | 6 | 6 |
| name | always | 6 | 6 |
| currentSeason | always | 6 | 6 |
| currentSeason.currentMatchday | always | 6 | 6 |
| seasons[].startDate | always | 394 | 394 |
| seasons[].endDate | always | 394 | 394 |

Dropped keys (names only): `area`, `currentSeason.winner`, `emblem`, `lastUpdated`, `seasons[].winner`, `type`

### GET /competitions/:code/matches?season

| Field | Presence | Present | Of |
|---|---|---|---|
| competition.name | always | 7 | 7 |
| matches[].id | always | 2257 | 2257 |
| matches[].utcDate | always | 2257 | 2257 |
| matches[].status | always | 2257 | 2257 |
| matches[].stage | always | 2257 | 2257 |
| matches[].matchday | sometimes | 2256 | 2257 |

Dropped keys (names only): `competition.code`, `competition.emblem`, `competition.id`, `competition.type`, `filters`, `matches[].area`, `matches[].awayTeam.crest`, `matches[].competition`, `matches[].group`, `matches[].homeTeam.crest`, `matches[].lastUpdated`, `matches[].odds`, `matches[].referees`, `matches[].score.duration`, `matches[].score.extraTime`, `matches[].score.halfTime`, `matches[].score.penalties`, `matches[].score.regularTime`, `matches[].score.winner`, `matches[].season`, `resultSet`

### GET /competitions/:code/matches?season&matchday or &stage

| Field | Presence | Present | Of |
|---|---|---|---|
| competition.name | always | 7 | 7 |
| matches[].id | always | 69 | 69 |
| matches[].utcDate | always | 69 | 69 |
| matches[].status | always | 69 | 69 |
| matches[].stage | always | 69 | 69 |
| matches[].matchday | sometimes | 68 | 69 |
| matches[].homeTeam.id | always | 69 | 69 |
| matches[].homeTeam.name | always | 69 | 69 |
| matches[].homeTeam.shortName | always | 69 | 69 |
| matches[].homeTeam.tla | always | 69 | 69 |
| matches[].awayTeam.id | always | 69 | 69 |
| matches[].awayTeam.name | always | 69 | 69 |
| matches[].awayTeam.shortName | always | 69 | 69 |
| matches[].awayTeam.tla | always | 69 | 69 |
| matches[].score.fullTime.home | always | 69 | 69 |
| matches[].score.fullTime.away | always | 69 | 69 |

Dropped keys (names only): `competition.code`, `competition.emblem`, `competition.id`, `competition.type`, `filters`, `matches[].area`, `matches[].awayTeam.crest`, `matches[].competition`, `matches[].group`, `matches[].homeTeam.crest`, `matches[].lastUpdated`, `matches[].odds`, `matches[].referees`, `matches[].score.duration`, `matches[].score.extraTime`, `matches[].score.halfTime`, `matches[].score.penalties`, `matches[].score.regularTime`, `matches[].score.winner`, `matches[].season`, `resultSet`

### GET /competitions/:code/standings?season&matchday

| Field | Presence | Present | Of |
|---|---|---|---|
| standings[].stage | always | 18 | 18 |
| standings[].type | always | 18 | 18 |
| standings[].group | never | 0 | 18 |
| standings[].table[].position | always | 408 | 408 |
| standings[].table[].team.id | always | 408 | 408 |
| standings[].table[].team.name | always | 408 | 408 |
| standings[].table[].playedGames | always | 408 | 408 |
| standings[].table[].won | always | 408 | 408 |
| standings[].table[].draw | always | 408 | 408 |
| standings[].table[].lost | always | 408 | 408 |
| standings[].table[].points | always | 408 | 408 |
| standings[].table[].goalsFor | always | 408 | 408 |
| standings[].table[].goalsAgainst | always | 408 | 408 |
| standings[].table[].goalDifference | always | 408 | 408 |

Dropped keys (names only): `area`, `competition.code`, `competition.emblem`, `competition.id`, `competition.type`, `filters`, `season`, `standings[].table[].form`, `standings[].table[].team.crest`

TOTAL tables seen: 6

## Response headers and statuses

- X-API-Version values: v4
- X-RequestsAvailable observed: not observed (UNVERIFIED)
- X-RequestCounter-Reset observed (seconds): 57 to 60 (last 58, 27 responses)
- Statuses: 200 x27
- Failures by resource kind: none
- 429 responses: 0
- 403 classification evidence (presence booleans only, never the value):
  - X-Authenticated-Client present on 2xx responses: yes
  - X-Authenticated-Client present on 403 responses: no 403 observed (UNVERIFIED)
  - Same value on every response that carried it: yes

## Rejected responses and outputs

Stage that rejected a received body or the adapter output built from it, with the failing validation path as schema field names and numeric indices only (any other segment `*`, never a value).

| Rejection | Count |
|---|---|
| domain validation on selection, path /teams/29/name | 1 |

## Response sizes

| Resource | Responses | Largest decoded body (bytes) | Above 512 KiB |
|---|---|---|---|
| GET /competitions | 1 | 5647 | no |
| GET /competitions/:code | 6 | 15292 | no |
| GET /competitions/:code/matches?season | 7 | 537320 | yes |
| GET /competitions/:code/matches?season&matchday or &stage | 7 | 18748 | no |
| GET /competitions/:code/standings?season&matchday | 6 | 28268 | no |

## Orchestrator notes for T62 (observations only, not decisions)

- CL league-phase matchday 1 is refused by the platform's domain validation of the selection snapshot at `/teams/29/name`: the name of one of the 36 league-phase teams fails the shared team-name rule (T10-F06: 1 to 64 characters; letters, marks, digits, spaces and `.'&-()` only; the http-api `TeamName` pattern). The value was not recorded, by design (T11H-F02); which character or length fails is UNVERIFIED. This is the FU-6 case "a shared domain rule": a security-control and contract change, to be classified under Contract Safety and decided above LOW. The CL final (whole stage) works.
- ELC now passes stage discovery and matchday 1 (12 matches, 24 standings rows); the largest season match list was 537320 bytes, above 512 KiB and within the 1 MiB `stageDiscovery` limit set by T59 (C8: confirms FU-4 and the T53 `too_large` reading).
- PD, BL1, SA and FL1 matchday 1 each returned all matches finished and full standings (20, 18, 20, 18 rows); together with PL and BSA from T53, every probed domestic league is fully confirmed on the free plan.
- CL 2025/26 knockout stages now show standings `unknown` and the final is selectable as a whole (FU-1 applied).
- 27 requests, all status 200, no 429; `X-RequestsAvailable` still not observed; whether the counter is per token stays UNVERIFIED (NV-10); no 403 observed (NV-8 unchanged).
