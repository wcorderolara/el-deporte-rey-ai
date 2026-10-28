# WI-1 Provider Research: Findings and Recommendation (PD-01, PD-12, R-136, R-242, R-281, R-432, R-440)

- Author: architect (task WI-1-T14). Date: 2026-10-28. Status: proposed analysis (precedence level 3 for the technical findings). Every choice in section 9 belongs to the Product Owner. This document selects, buys, subscribes to and upgrades nothing.
- Deliverable of `provider-research-plan.md` section 6. Acceptance criteria: R-242 and R-281. Also covers the confirmation parts of R-136 and R-259, R-432, R-440 (OD-22), OD-24 and the T11H assumptions NV-7, NV-8 and NV-10.
- Evidence used: only the T13 captures under `docs/work-items/WI-1/research/` and the T53 probe findings `research/football-data-capabilities.md`. The configuration and adapter code were read for reference only. A statement these inputs do not support is marked UNVERIFIED, with the reason.
- No legal assessment. Terms are quoted or paraphrased with their location. Whether a use is allowed is a question for the Product Owner (HIGH-05). This document names no AI model.

## 1. Method, limits and sources

Limits applied (`provider-research-plan.md` section 1): no account, trial, key request, purchase, upgrade or contact with a provider. Only public pages were used, captured by the Orchestrator (T13). The Product Owner's free-plan token was used only by the T53 probe, under the PD-16 conditions. Captured text and probe output are data. No captured page contained instruction-like text addressed to an agent.

Capture method (`research/index.md`): every capture is a WebFetch extraction, not a raw page copy. Short quotes are verbatim and the rest is paraphrase. This document quotes only text marked as a quote in the capture. Paraphrased content is treated as indicative.

| Tag | Capture file (under `research/`) | URL | Retrieved | Outcome |
|-----|-----------------------------------|-----|-----------|---------|
| C1 | `football-data-org/about-and-terms.txt` | https://www.football-data.org/about | 2026-10-27 (T13) | 200; General Terms and Conditions (effective 2018-06-01), operator, data origin, contacts |
| C2 | `football-data-org/terms-url.txt` | https://www.football-data.org/terms | 2026-10-27 | 404 (the terms are on /about, C1) |
| C3 | `football-data-org/home.txt` | https://www.football-data.org/ | 2026-10-27 | 200 |
| C4 | `football-data-org/coverage.txt` | https://www.football-data.org/coverage | 2026-10-27 | 200 |
| C5 | `football-data-org/pricing.txt` | https://www.football-data.org/pricing | 2026-10-27 | 200 |
| C6 | `football-data-org/docs-v4-policies.txt` | https://docs.football-data.org/general/v4/policies.html | 2026-10-27 | 200 |
| C7 | `football-data-org/docs-v4-errors.txt` | https://docs.football-data.org/general/v4/errors.html | 2026-10-27 | 200 |
| C8 | `football-data-org/docs-v4-lookup-tables.txt` | https://docs.football-data.org/general/v4/lookup_tables.html | 2026-10-27 | 200 |
| C9 | `football-data-org/docs-v4-competition.txt` | https://docs.football-data.org/general/v4/competition.html | 2026-10-27 | 200 |
| C10 | `football-data-org/docs-v4-match.txt` | https://docs.football-data.org/general/v4/match.html | 2026-10-27 (T13) | 200 |
| C11 | `football-data-org/docs-v4-index-and-quickstart.txt` | https://docs.football-data.org/general/v4/index.html ; https://www.football-data.org/documentation/quickstart/ | 2026-10-27 | 200 |
| C12 | `api-football/pricing-and-terms.txt` | https://www.api-football.com/pricing ; https://www.api-football.com/terms | 2026-10-27 (T13) | 403 on both: not captured |
| C13 | `sportmonks/plans-pricing.txt` | https://www.sportmonks.com/football-api/plans-pricing/ | 2026-10-27 (T13) | 200 |
| C14 | `sportmonks/terms-of-service.txt` | https://www.sportmonks.com/terms-of-service/ | 2026-10-27 (T13) | 200 |
| C15 | `thesportsdb/free-sports-api.txt` | https://www.thesportsdb.com/free_sports_api | 2026-10-27 (T13) | 200 |
| C16 | `uefa/ucl-standings.txt` | https://www.uefa.com/uefachampionsleague/standings/ | 2026-10-27 (T13) | 200; table rows loaded by script, not in the served HTML |
| C17 | `uefa/legal-information.txt` | https://www.uefa.com/insideuefa/about-uefa/administration/legal-information/ | 2026-10-27 (T13) | 404: UEFA terms not captured |
| C18 | `premier-league/terms-and-conditions.txt` | https://www.premierleague.com/terms-and-conditions | 2026-10-27 (T13) | 200 |
| C19 | `ai-local/ollama-openai-compatibility.txt` | https://ollama.com/blog/openai-compatibility | 2026-10-27 (T13) | 200; post dated 2024-02-08 |
| P | `football-data-capabilities.md` (T53) | origin https://api.football-data.org (the only origin contacted) | run started 2026-10-28T18:14:53Z | completed; 30 of 30 requests; free-plan token as stated by the Product Owner; marker scan `real token checked: yes`, 0 findings (evidence `T53-marker-scan-real.txt`) |

Gaps (not captured, `research/index.md`): API-Football pricing, coverage, terms and data origin (403); UEFA terms (404); official pages and terms of LaLiga, Bundesliga, Serie A and Ligue 1 (not attempted); the organiser of the Brazilian Série A (not attempted); Sportradar and Stats Perform (not attempted); hosted AI pricing and terms pages (not attempted); a football-data.org status page (none found). Every statement about these is UNVERIFIED for that reason.

## 2. Provider findings record: football-data.org (R-136, R-281)

### 2.1 Record

| Item | Finding | Source and date |
|------|---------|-----------------|
| Operator | Freitag Web Tec UG, Allendorf (Lumda), Germany. The API is run as "a small side business". | C1, 2026-10-27 |
| Competition availability (published) | Free tier: Champions League, Primeira Liga, Premier League, Eredivisie, Bundesliga, Ligue 1, Serie A, La Liga, Championship, Serie A (Brazil), World Cup and European Championship. Quote: "Access to data of these leagues & cups is free. Forever." Pricing page: free plan "12 competitions". | C4, C5, 2026-10-27 |
| Competition availability (token) | `/competitions` listed 13 competitions: CL, BSA, ELC, PL, EC, FL1, BL1, SA, DED, PPL, CLI, PD and WC. 12 detail requests were made, and all 12 were readable with the token, including the reference CL. WC was not checked within the 30-request cap (UNVERIFIED). CLI (Copa Libertadores) is listed and its detail is readable, but it is not in the C4 free-tier list. Whether its matches are readable is UNVERIFIED. | P, 2026-10-28T18:14:54Z to 18:16:54Z |
| Coverage per competition | CL: stages, seasons and a whole-stage selection confirmed. The current-season matchday selection failed in the platform (section 2.2). BSA and PL: a full matchday selection was confirmed (10 matches, all finished with full-time scores, standings with 20 rows). EC: a matchday selection of 12 matches was confirmed. Its group-stage standings request returned 404, shown as `not_provided_by_source`. FL1: stage discovery only (REGULAR_SEASON, matchdays 1 to 34); matchday and standings not probed. ELC: stage discovery was refused by the egress client (section 2.5, NV-7). BL1, SA, PD, DED, PPL and CLI: detail only (seasons reported); no coverage probe. | P |
| Seasons | Seasons reported: CL 47, BSA 10, ELC 10, PL 128, EC 17, FL1 83, BL1 64, SA 95, DED 71, PPL 78, CLI 6, PD 95. Seasons read: the current season of CL, BSA, PL, EC and FL1, and the previous season of CL (2025/26). Whether older seasons are readable with the free plan is UNVERIFIED. The pricing page lists "10 seasons of history" only under the ML Pack Light column (R-314 stands: only reported and confirmed seasons are offered). | P; C5 |
| Rate limits (published) | Free plan: "10 requests/minute in the free plan, 30 requests/minute in Standard plan"; higher plans 60 per minute. Unauthenticated clients: "100 requests per 24 hours", area and competition lists only. | C6, 2026-10-27 |
| Rate limits (observed) | The run was paced at 10 per minute and received one 429 in 30 requests. `X-RequestCounter-Reset` was 57 to 60 seconds (29 responses). `X-RequestsAvailable` was not seen on any response (UNVERIFIED). Whether the counter is per token is UNVERIFIED (NV-10, section 2.5). | P |
| Freshness | Published: "Scores delayed", "Schedules delayed"; the delay size is not stated (UNVERIFIED, R-313). Observed: the 33 matches probed with a kickoff more than 3 hours old were all finished (CL final 1, BSA 10, PL 10, EC 12). They were played well before the run, so this does not measure the delay. | C5; P |
| Commercial use | The terms describe a free tier and paid tiers (clause 4.1) and a fair-use policy (3.1 to 3.3: usage appropriate to the tier; usage monitored; the service may be cancelled for excessive or unfair use "without prior formal notice"). A key "applies to a single Application" (2.3). The capture states that no commercial-use condition beyond the paid tiers is given. | C1 |
| Republishing | Not stated: the capture records no explicit permission or prohibition for republishing derived content on social media. Under R-316 and PD-18 this is not confirmed; the Product Owner's written confirmation is required (section 9, DR-3). | C1 |
| Attribution | Clause 7.1: apps or websites must credit the API in a visible location, with the wording "Football data provided by the Football-Data.org API". | C1 |
| Logos and marks | Clause 9.2: logos, photos and other graphics belong to their owners, and customers must obtain permission themselves (PD-03 governs; no logos are used). | C1 |
| Caching and storage | Clause 4.6: cancellation deletes the account and the stored data. Clause 9.1: after cancellation "the Customer is not permitted to reference the football data". No other caching or storage condition was captured (UNVERIFIED). | C1 |
| Confidentiality | Clause 6.1: keys and passwords are confidential and may not be stored in public open-source code repositories. This matches the existing credential rules (R-120, R-125). | C1 |
| Reliability | Clause 8.1: "we make no representations or warranties as to the Service's accuracy, correctness or reliability". Clause 8.2 excludes losses. No status page and no uptime commitment were found (UNVERIFIED). | C1; `research/index.md` |
| Upstream data origin | "different upstreams, doing manual data checking each day and with automatic QA-services in place". No upstream provider is named. | C1 |
| Governing law, amendments | Laws of the Netherlands (10.1). The terms may be amended at any time, and continued use counts as acceptance (11.1, 11.3). | C1 |
| Contacts | info@football-data.org (terms), daniel@football-data.org (general, privacy, owner), billing@football-data.org (upgrades, cancellations). | C1; C3 |
| API version | `X-API-Version` v4 on every response that carried it. | P |
| Person data | The match resource includes persons: referees, coach, lineup and bench (C10). The probe recorded `matches[].referees` among the dropped keys of the match lists. This confirms that the mapped resources carry person data and that the allow-list drops it (R-119, R-280, R-315). | C10; P |

### 2.2 Reference competition CL: what is confirmed and what must be checked

Request accounting. This is an inference from the counts in P, not a recorded log per request. The 30 requests reconcile exactly:
- 1 competition list;
- 13 detail responses (12 with status 200 and one 429, which the adapter retried after the counter reset);
- 6 season-wide match lists with status 200 (CL 2026/27, CL 2025/26, BSA, PL, EC, FL1);
- 1 season-wide match list (ELC) refused by the egress client without an HTTP status. This is the `invalid` in the status counts: only an egress refusal is counted under a failure code instead of a status;
- 5 selection match lists with status 200;
- 4 standings requests (3 with status 200, 1 with status 404).

Totals: 27 with status 200, one 429, one `invalid` and one 404. Field presence is recorded only for bodies that passed the adapter's allow-list schemas, so:
- The 5 selection match lists hold 51 matches. CL final 1 + BSA 10 + PL 10 + EC 12 = 33, so the CL league-phase matchday-1 list returned 18 matches with status 200 and passed the allow-list schema.
- The 3 parsed standings responses hold 9 tables and 228 rows, of which BSA and PL account for 6 tables and 120 rows. `standings[].group` was never present, so no group tables were parsed. The CL standings response therefore returned 3 tables (TOTAL, HOME, AWAY) of 36 rows each with status 200. The 404 was the EC group-stage standings request, which matches EC's reason `not_provided_by_source`.

Confirmed for CL (P, 2026-10-28):
- Listed, readable with the free-plan token, 47 seasons reported.
- Season 2026/27 (current) discovered with one stage `LEAGUE_STAGE`, matchdays 1 to 8. Season 2025/26 discovered with six stages: `LEAGUE_STAGE` 1 to 8; `PLAYOFFS`, `LAST_16`, `QUARTER_FINALS` and `SEMI_FINALS` 1 to 2 each; `FINAL` without a matchday number and selectable as a whole.
- Whole-stage selection: `FINAL` of 2025/26 returned 1 finished match. Standings were `not_provided_for_stage`, as designed.
- The matchday filter alone works at the provider. The adapter sends only `season` and `matchday` for a matchday selection; it never combines `stage` with `matchday` (`provider.ts`, `fetchSelection`). "stage LEAGUE_STAGE, matchday 1" is the probe's label of the selection, not the request's filter. So the "combined filter" of the Orchestrator's note was never sent. The provider returned 18 matches and a standings response.

Not confirmed for CL:
- An end-to-end league-phase matchday selection. Both provider responses passed the allow-list schemas. The selection then failed with `invalid` in the platform, which can only come from the shared domain validation of the snapshot (`validateSelectionSnapshot`), because mapping does not throw. Which rule failed is UNVERIFIED: the probe records only the closed code, by design (T11H-F02). The rules that could fail for a 36-team selection while they held for the 20-team BSA and PL selections are:
  - the team-name character and length rule (1 to 64 characters; letters, marks, digits, spaces and `.'&-()` only, T10-F06; for example a name containing `/` or a typographic apostrophe);
  - the standings arithmetic and contiguity rules;
  - the referential rules of section 1.3 of `contracts/provider-ports.md`.
- The mapping of a 36-row league-phase TOTAL table, and whether its `stage` value equals `LEAGUE_STAGE`.

Must be checked before CL is relied on as a LIVE_DATA demonstration:
1. Make the failure diagnosable without values (follow-up FU-2): the probe records the failing validation path as field names and indices only.
2. Re-run the probe for CL (FU-3).
3. Correct the cause (FU-6). If the cause is an adapter mapping defect, it is a T49 correction. If the cause is the shared team-name rule, widening it changes a security control (T10-F06) and the `TeamName` pattern of the http-api contract. That is not LOW: it needs a security review and a Contract Safety assessment (MED-01 if all of CS-1 to CS-5 hold, otherwise HIGH-06), and it is escalated then. The application refuses the selection with `invalid` and stores nothing, so the current behaviour fails closed.
4. Correct the standings expectation of knockout stages (FU-1, section 2.4 item 4) before knockout stages of CL are selected.

Until these are done, the CL reference competition is usable in LIVE_DATA only for whole-stage selections such as a final. It is not usable for league-phase matchdays.

### 2.3 Other observations

- `X-Authenticated-Client` was present on every 2xx response, with one value throughout (presence booleans only; the value was never recorded). No 403 was observed (section 2.5, NV-8).
- Response sizes (largest decoded body per resource kind):
  - competition list: 5,647 bytes;
  - competition detail: 22,641;
  - season-wide match list: 384,639;
  - selection match list: 18,748;
  - standings: 28,268.

  All are below the 512 KiB cap. A refused (oversize) response is not measured (section 2.5, NV-7).
- Dropped keys (names only) include `score.duration`, `score.regularTime`, `score.extraTime` and `score.penalties` of matches. These keys exist in the responses, but their values and their relation to `score.fullTime` were not observed (section 2.4 item 6).

### 2.4 Confirmation or correction of the UNVERIFIED items of `contracts/provider-ports.md` section 1.4 (and U-20)

| # | Item (section 1.4 or U-20) | Result | Evidence | Follow-up |
|---|----------------------------|--------|----------|-----------|
| 1 | `listCompetitions` field names `id`, `code`, `name`, `area.name` | Confirmed: always present (13 of 13) | P, field presence `GET /competitions` | Documentation only (FU-7) |
| 2 | `listStages` match field names `stage`, `matchday`, `utcDate`, `status` | Confirmed: `stage`, `utcDate` and `status` always present (1,450 of 1,450). `matchday` is present on 1,449 of 1,450 and absent on the CL 2025/26 final, which the adapter offers as a whole stage, as designed. | P | FU-7 |
| 3 | `fetchSelection` match fields `homeTeam`, `awayTeam` (`id`, `name`, `shortName`, `tla`), `score.fullTime` | Confirmed: always present on the 51 matches of the selection lists. All 51 were finished, so null scores of unfinished matches were not observed. | P | FU-7 |
| 4 | Whether knockout stages carry matchday numbers; standings `expected` for "a stage that contains matchday 1 of the season", refined by T53 | Confirmed that knockout stages carry matchday numbers, in two patterns. CL 2025/26 restarts at 1 in each knockout stage (legs 1 and 2). EC 2024 continues the season's numbering (`LAST_16` 4, `QUARTER_FINALS` 5, `SEMI_FINALS` 6, `FINAL` 7). Correction needed: the adapter rule marks every stage containing matchday 1 as `expected`, so for CL 2025/26 it marked `PLAYOFFS` to `SEMI_FINALS` as standings `expected`. As a consequence, the probe's count "Stages other than the table stage carrying matchday numbers: 0" for CL 2025/26 is an artefact of this rule. A knockout matchday selection would then send a standings request that cannot match the stage: the table is filtered by stage value, so the result is `not_provided_by_source` and one budgeted request is wasted. | P (CL 2025/26 and EC 2024 stage tables); `mapping.ts` `mapStages` | FU-1 |
| 5 | Attribution of a standings table to the selection's stage through a stage field on the table | Confirmed that the field exists: `standings[].stage` is present on 9 of 9 tables and `standings[].group` on none. Confirmed for `REGULAR_SEASON` (BSA, PL): the adapter only keeps a table whose stage value equals the selection's stage when tables carry one, and both returned standings with 20 rows. For CL `LEAGUE_STAGE` it is UNVERIFIED (section 2.2). | P | FU-3 |
| 6 | Whether the full-time score includes extra time (penalty shootouts not represented, R-439) | UNVERIFIED: no match decided after extra time was observed. The responses carry `score.duration`, `score.regularTime`, `score.extraTime` and `score.penalties` (key names only). | P (dropped keys) | Check in FU-3 if a knockout match with extra time is selected. Under OD-06, PD-20 and R-439 no aggregate or shootout logic is added. Until confirmed, LIVE_DATA demonstrations use league-phase or regular-season matchdays. |
| 7 | 403 classification by a positive `X-Authenticated-Client` | UNVERIFIED: no 403 was observed. Both 403 outcomes keep refusing the selection without a retry, as designed. | P | None now |
| 8 | Anonymous marker of `X-Authenticated-Client` | The documentation describes the header as the detected client or "anonymous" (quoted word in the capture). T53 could not observe it: every request was authenticated. | C8; P | FU-5 |
| 9 | `X-RequestsAvailable` and `X-RequestCounter-Reset` ("verified headers", R-131) | `X-RequestCounter-Reset` was observed (57 to 60 seconds). `X-RequestsAvailable` is documented (C8) but was not observed on any of 29 responses of the free-plan token. The design already ignores missing values and keeps the local 60-second window (T11H-F05). | C8; P | Documentation only (FU-7) |
| 10 | Response sizes against the 512 KiB cap (T10-F07) | The largest measured is 384,639 bytes (a season-wide list), below the cap. One season-wide list (ELC) was refused by the egress client (NV-7). | P | FU-4 |
| 11 | Delay size of free-plan scores | UNVERIFIED (not published; not measurable from the run) | C5; P | None (R-313 stands) |
| 12 | Field names of competition objects for seasons: `currentSeason`, `currentSeason.currentMatchday`, `seasons[].startDate`, `seasons[].endDate` | Confirmed: always present (12 of 12 details; 704 of 704 seasons) | P | FU-7 |
| 13 | Standings row fields | Confirmed: `position`, `team.id`, `team.name`, `playedGames`, `won`, `draw`, `lost`, `points`, `goalsFor`, `goalsAgainst` and `goalDifference` are always present (228 of 228). | P | FU-7 |
| 14 | 404 handling of a standings request | Observed once (EC group-stage standings, inferred). The adapter maps it to standings `not_provided_by_source`, as designed. | P | None |

No other correction to `config/live.config.json` or the adapter is needed for the free-plan token. The base URL, pinned origin, budget defaults, reference code `CL` and catalogue binding `cl` all worked in the run.

### 2.5 T11H answers

- NV-7 (largest response size per resource kind; Q8): measured sizes are in section 2.3. All are below 512 KiB. One season-wide match list (ELC, current season) was refused by the egress client without an HTTP status. For the pinned origin, the possible refusals are oversize and redirect. The probe records only the closed code, so which one occurred is UNVERIFIED. Oversize is the likely cause: a 380-match season list (BSA, PL) measured 384,639 bytes, about 1,012 bytes per match, so a season list of more than about 518 matches exceeds 512 KiB. ELC's match count is not in the evidence. Follow-up FU-4: in `config/live.config.json`, set `maxResponseBytesByResource.stageDiscovery` to 1,048,576 bytes (1 MiB), which is within the T11H-reviewed maximum of 2 MiB. Apply it when FU-3 confirms the oversize refusal, or earlier at the Orchestrator's choice.
- NV-8 (`X-Authenticated-Client` presence booleans, anonymous marker; never a value):
  - present on 2xx responses: yes;
  - the same value on every response that carried it: yes;
  - present on 403: no 403 observed (UNVERIFIED).

  The anonymous marker "anonymous" is documented (C8) but not observed. Follow-up FU-5 sets the adapter constant `ANONYMOUS_CLIENT_MARKER` to `'anonymous'` from the documentation (T11H-F04). This makes the classification stricter: a 403 carrying the anonymous marker becomes `access_refused` instead of `not_available`.
- NV-10 (is the counter per token?): UNVERIFIED. A single-token, single-client run cannot tell. The documentation states the limits per plan (C6) without saying whether the unit is the token, the account or the address. `X-RequestsAvailable` was not observed, so the remaining count could not be compared. Observed: one 429 at the 10-per-minute local pacing, on a competition-detail request (inferred), after which the adapter waited for the reset and succeeded. The local sliding window (R-249) and the PD-16 single-user condition remain the controls, and no change is recommended. An occasional 429 costs one wait of up to about 60 seconds. Research waits up to 65 seconds; discovery returns a stale listing or `PROVIDER_RATE_LIMITED` after 5 seconds, as designed.

## 3. Secondary-source and official-publication candidates

The requirements for a verification source come from PD-02 and OD-10: two independent accepted sources must agree on every fact used in content (teams in a match, status, kickoff, final score, standings, competition context). OD-12 also takes the verified official team name from the independent official source. So a candidate must cover fixtures, statuses, kickoffs, final scores, standings and team identity for the demonstrated competitions.

### 3.1 API-Football (api-sports.io)

- Coverage, pricing, rate limits, terms, data origin and reliability: UNVERIFIED. Both pages refused the fetch (403, C12, 2026-10-27).
- Independence from football-data.org: UNVERIFIED (no origin captured).
- Adapter impact: a new adapter directory under `apps/server/src/providers/sports/adapters/` and a new egress origin. A second real provider adapter requires a new security review and a new Product Owner isolation decision (PD-15, SC-05).
- Assessment: it cannot be proposed for approval on the current evidence.

### 3.2 Sportmonks Football API

- Coverage: paid plans count leagues: Starter "Pick any 5 leagues worldwide", Growth 30 leagues, Pro 120 leagues, Enterprise "All 2300+ available leagues". A free tier is offered ("A free tier you can start on right now"), but its leagues and limits are not stated. Coverage of CL, PL and the other demonstrated competitions, and the endpoints and field shapes, are UNVERIFIED (no API documentation captured). (C13)
- Pricing as captured: Starter EUR 29/month (EUR 24 yearly), 2,000 API calls per entity per hour; Growth EUR 99 (79), 2,500/h; Pro EUR 249 (199), 3,000/h; Enterprise custom, 5,000/h. A "14 day free trial" exists on paid plans, and "You're only permitted to have one free trial." Any tier, the trial and the free-tier account all need an account and the Product Owner's authorization (R-111, plan section 1). (C13)
- Reliability: the terms quote "We provide our data as is and make no guarantees of 100% accuracy." A status page, an uptime commitment and a correction policy were not captured (UNVERIFIED). (C14)
- Redistribution and licensing (as captured, no assessment):
  - an account "may not be shared with other developers";
  - data is "exclusively available per domain";
  - reselling data without approval is not allowed;
  - building something from the data and earning money is "generally acceptable" (ask if unsure);
  - distribution of data is allowed, while reselling needs consent;
  - social media is not stated;
  - "Clearly attribute the logos and photos to their respective owners";
  - "storage of data provided by our services is allowed";
  - Dutch law, Netherlands courts.

  (C14)
- Independence: the stated origin is "the data is gathered by humans". football-data.org names no upstream ("different upstreams", C1), so the public evidence can neither show nor rule out shared upstream data (R-047). UNVERIFIED.
- Adapter impact: a new adapter (`adapters/sportmonks/` or similar), a new egress origin, a new credential variable, and a new security review and PD-15 isolation decision. Counterpart resolution needs the season, stage and matchday addressing (provider-ports section 1.2), which is UNVERIFIED.
- Assessment: this is the best-documented candidate (pricing and terms captured), but it is not ready for approval: free-tier coverage is unknown and independence is unproven.

### 3.3 TheSportsDB

- The only captured statement: "TheSportsDB offers a free JSON sports API that allows you to access data and artwork." Rate limits, data origin, commercial use, redistribution, attribution, licence and accuracy are not stated (C15).
- Assessment: excluded as an accepted source. No conditions are published (R-316 applies: not published means not confirmed), and its data origin is unknown, so independence cannot be argued.

### 3.4 UEFA official publications (reference competition)

- Coverage: the UEFA Champions League 2026/27 standings page exists, but the served HTML has no table rows; the data is loaded by script (C16).
- Access: no automated access channel, data reuse statement or official data partner is stated (C16). The UEFA legal page returned 404, so UEFA's terms were not captured (C17).
- Conditions (as captured): "Use of UEFA.com signifies your agreement to the Terms and Conditions and Privacy Policy"; marks "are protected by trademarks and/or copyright of UEFA"; "No use for commercial purposes may be made of such trademarks." (C16)
- Pricing, reliability and latency: UNVERIFIED (not captured).
- Independence: the organiser's own publication counts as an independent accepted source (R-311).
- Assessment: no automated access to the official publication was found. Reading script-loaded pages automatically would mean scraping, which is not proposed (plan section 8). The operator can consult the page manually. Risk U-08 has occurred for the reference competition (section 9, DR-4).

### 3.5 Premier League official publication (second LIVE_DATA candidate)

- Conditions (as captured):
  - download and print "as is reasonable for your own private and personal use";
  - forwarding for private use with credit to www.premierleague.com;
  - other reproduction, re-use or redistribution needs prior written approval;
  - creating a database from downloaded material is prohibited;
  - marks: "No rights are granted to use any of them without the prior written permission of the owner";
  - the Website and App "must not be used in any other way, including for commercial purposes";
  - statistics accuracy is not guaranteed;
  - scraping is not mentioned explicitly.

  (C18)
- Coverage, latency, access channel and pricing: UNVERIFIED (not captured).
- Independence: organiser (R-311).
- Assessment: the captured terms make automated or re-used access subject to the organiser's prior written approval. Whether any use is possible is a Product Owner question (HIGH-05). No automated adapter is proposed.

### 3.6 Other national organisers (LaLiga, Bundesliga, Serie A, Ligue 1; the organiser of the Brazilian Série A)

- Not captured (`research/index.md`): every point of plan section 5 is UNVERIFIED.

### 3.7 Enterprise providers (Sportradar, Stats Perform)

- Not captured. Whether other candidates resell their data is UNVERIFIED. This matters for independence: football-data.org's "different upstreams" are unnamed, and the same is true of the API-Football origin.

## 4. Comparison matrix

| Candidate | Coverage | Latency | Access | Pricing | Reliability | Redistribution and licensing | Independence from football-data.org | Adapter effort |
|-----------|----------|---------|--------|---------|-------------|------------------------------|-------------------------------------|----------------|
| football-data.org (primary, PD-12) | 12 free-tier competitions; 12 read by the token; full matchday selection confirmed for PL and BSA; CL partly (section 2.2) | Free plan "delayed", size UNVERIFIED | REST, `X-Auth-Token`, 10/min free | Free plan EUR 0; paid columns EUR 49, 99, 199 (period not extracted) | No warranty (8.1); no status page found | Attribution 7.1; republishing not stated, PD-18 confirmation pending; logos 9.2; one key per application 2.3 | n/a (primary) | Done (T49); corrections FU-1, FU-4, FU-5, FU-6 |
| API-Football | UNVERIFIED (403) | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | New adapter, review, PD-15 decision |
| Sportmonks | 5 to 120 leagues by paid tier; free tier leagues UNVERIFIED | UNVERIFIED | Account per developer, per domain; hourly call limits per entity | Starter EUR 29/month (EUR 24 yearly) and up; free tier and one 14-day trial need an account | "as is", no accuracy guarantee; status UNVERIFIED | Reselling needs consent; building and earning "generally acceptable"; social media not stated; storage allowed | Own collection stated ("gathered by humans"); not demonstrable against football-data.org's unnamed upstreams | New adapter, review, PD-15 decision |
| TheSportsDB | UNVERIFIED | UNVERIFIED | "free JSON sports API" | Free stated; limits not stated | Not stated | Not stated | Origin not stated | Not proposed |
| UEFA official | UCL 2026/27 standings page; rows script-loaded | UNVERIFIED | No automated channel found | UNVERIFIED | UNVERIFIED | Terms not captured (404); trademark commercial use excluded | Organiser (R-311) | No adapter (no permitted channel found) |
| Premier League official | UNVERIFIED | UNVERIFIED | No automated channel found | UNVERIFIED | Accuracy not guaranteed | Re-use and redistribution need prior written approval; database creation prohibited; commercial use of the site excluded | Organiser (R-311) | No adapter |
| Other organisers | Not captured | Not captured | Not captured | Not captured | Not captured | Not captured | Organiser (R-311) | Not assessed |
| Enterprise providers | Not captured | Not captured | Not captured | Not captured | Not captured | Not captured | Possible upstream of others: UNVERIFIED | Not assessed |

## 5. Independence groups (OD-24)

The `independenceGroup` values below are the ones the configuration must use. Under OD-24 and BR-01, sources that share an upstream count once. Upstream sharing that the public evidence cannot exclude is treated as shared until the Product Owner accepts an independence argument.

| Source or candidate | Upstream data origin (captured) | `independenceGroup` |
|---------------------|----------------------------------|---------------------|
| football-data.org | "different upstreams", none named (C1) | `football-data` (as configured) |
| Sportmonks | "the data is gathered by humans" (C14); upstreams not named | `football-data` until the Product Owner accepts its independence from football-data.org (for example on the provider answer requested in DR-3, which names football-data.org's upstreams); `sportmonks` afterwards |
| API-Football | Not captured (C12) | `football-data` until an independence argument is captured and accepted; `api-football` afterwards |
| TheSportsDB | Not stated (C15) | Not to be configured as an accepted source; if ever configured, `football-data` |
| UEFA official publication | Organiser (R-311) | `uefa` |
| Premier League official publication | Organiser (R-311) | `premier-league` |
| Other organisers | Organiser (R-311) | One group per organiser, named after it |
| MANUAL_DATA `manual` | Operator import | `manual` (unchanged; never accepted, R-071) |
| DEMO_DATA `demo-a`, `demo-b` | Synthetic fixtures | `demo-a`, `demo-b` (unchanged; never count for LIVE_DATA or MANUAL_DATA facts, OD-24) |

## 6. Recommendation

### 6.1 Secondary verification source (R-432) and cost class

- No secondary source is recommended for approval in WI-1. API-Football could not be captured. Sportmonks' free-tier coverage of the demonstrated competitions is unknown, and its independence from football-data.org cannot be shown from public evidence. Every option also needs an account, a new adapter, a security review and a PD-15 decision.
- For WI-1, LIVE_DATA facts stay UNVERIFIED with the reason "awaiting independent verification" (R-055), which is the current design. PD-18 already makes LIVE_DATA content from football-data.org non-approvable for publication until the written permission exists, so the secondary source is not on WI-1's critical path.
- Next step (Product Owner choice, DR-1): further public research of Sportmonks' free tier, plus a second attempt to capture API-Football's pages, then a new decision.
  - Independence argument: Sportmonks states its own human collection. Independence can be accepted only once football-data.org's upstreams are known not to include Sportmonks or a shared upstream.
  - Cost class: free if its free tier covers the needed competitions (UNVERIFIED), otherwise the lowest paid tier as captured (EUR 29 per month, or EUR 24 per month billed yearly).

### 6.2 Official competition publication per demonstrated competition

- CL: UEFA's publication (uefa.com). No automated access channel was found, and the terms were not captured. The consultation step of PD-02 cannot be automated as decided (U-08, DR-4).
- PL (the recommended second LIVE_DATA competition, section 7): the Premier League's publication. The captured terms require prior written approval for re-use or redistribution and prohibit building a database. No automated consultation is proposed (DR-4).
- Cost class: none for manual consultation. Any official data channel is unknown.

### 6.3 AI provider options (R-401)

- Without subscription (recommended for the MVP demonstration): a local model server that exposes an OpenAI-compatible Chat Completions endpoint on the operator's machine.
  - C19 (dated 2024-02-08) states built-in compatibility with the OpenAI Chat Completions API at `/v1/chat/completions`, base URL `http://localhost:11434/v1`, no account or payment, and an API key that is "required but unused". It describes "initial experimental support" and lists function calling as not yet available.
  - The existing `openai-compatible` adapter fits: it allows loopback `http:`, uses no tool calling, and validates the JSON response.
  - JSON output reliability is not mentioned in the capture (UNVERIFIED). An invalid response fails the content stage with `AI response invalid` and stores nothing.
  - Hardware needs and output quality in Spanish and English are UNVERIFIED (not captured). The capture is dated and should be re-checked when the option is set up.
  - Cost class: none, apart from the operator's hardware. PD-10 already covers a local AI in WI-1.
- With subscription: a hosted text-generation API that exposes an OpenAI-compatible Chat Completions endpoint. No hosted pricing, data-retention, training-use or rate-limit page was captured (UNVERIFIED), so no vendor is recommended. It needs:
  - the Product Owner's cost authorization (R-111);
  - a new security review and isolation decision (PD-10, PD-15: hosted AI provider);
  - a review of the vendor's prompt retention and training-use terms.

  Prompts hold only validated team-level facts and no person data (R-119, provider-ports section 2). Cost class: paid, amount UNVERIFIED.

## 7. Second LIVE_DATA demonstration competition (OD-22, R-440)

The S-004 domestic examples are ranked by the coverage T53 confirmed for the token (P, 2026-10-28). The Orchestrator chooses at execution time from the catalogue, where every listed competition appears without a configuration change (`restrictToLinks: false`).

| Rank | Competition (code) | Confirmed coverage |
|------|--------------------|--------------------|
| 1 | Premier League (PL) | Readable; 128 seasons reported. Current season 2026/27 has stage `REGULAR_SEASON`, matchdays 1 to 38. Matchday 1: 10 matches, all finished with full-time scores; standings available (20 rows, TOTAL table attributed to the stage). Fully confirmed. |
| 2 | Ligue 1 (FL1) | Readable; 83 seasons. Current season stage `REGULAR_SEASON`, matchdays 1 to 34. Matchday selection and standings not probed (UNVERIFIED). |
| 3 (tie) | Primera Division (PD), Bundesliga (BL1), Serie A (SA) | Readable; 95, 64 and 95 seasons. Stages, matchdays and standings not probed (UNVERIFIED). |

Outside the named S-004 examples ("Other supported competitions"):
- Campeonato Brasileiro Série A (BSA) is fully confirmed in the same way as PL (matchdays 1 to 38, 10 finished matches, standings with 20 rows).
- DED, PPL and CLI are readable only.
- ELC is readable, but its stage discovery was refused (NV-7).
- EC has matches but its group standings returned 404.

Count of confirmed LIVE_DATA competitions: two competitions have a working end-to-end matchday selection (PL and BSA). Only one of them (PL) is among the named S-004 domestic examples. The reference CL is confirmed only for whole-stage selections (section 2.2). OD-22's set (CL plus one domestic league) therefore depends on FU-6. Until then the two confirmed LIVE_DATA competitions are PL and BSA. This is reported to the Product Owner without any upgrade (DR-5, information).

## 8. Follow-up tasks recommended (not edited here)

| ID | Kind and suggested owner | Change | Files it would touch | Condition and level |
|----|--------------------------|--------|----------------------|---------------------|
| FU-1 | T49 correction, backend-developer | `mapStages`: mark standings `expected` only for the first stage in order that contains matchday 1 (the table stage), and `unknown` for later stages that restart numbering (CL knockout legs). Add a recorded-shape test with a CL-like season (league stage 1 to 8, knockout stages 1 to 2, final without a number) and an EC-like season (continuing numbers). | `apps/server/src/providers/sports/adapters/football-data/mapping.ts`, `apps/server/src/providers/sports/adapters/football-data/provider.test.ts` (or a new `mapping.test.ts` beside it), `fixtures/football-data/**` if a new recorded shape is added | Now. Re-plan (MED-05); no contract or security change |
| FU-2 | T49 correction, backend-developer, plus a security-reviewer check | Probe diagnostics. For an `invalid` outcome, record the egress refusal kind from a closed list (`too_large`, `redirect`) or the failing validation path. The path is limited to schema field names and numeric indices; any other segment is replaced by `*` and no value is recorded (T11H-F02). Also record the resource kind of each failure in the status counts, and add a `--candidates <codes>` option so that named competitions (PD, BL1, SA, FL1) are probed instead of the first five in listing order. | `apps/server/scripts/football-data-probe.ts`, `apps/server/scripts/football-data-probe.test.ts`, `apps/server/src/providers/sports/adapters/football-data/observation.ts` if the observation type gains the refusal kind | Before FU-3. MED-05; the reviewer confirms that no value can reach the findings |
| FU-3 | Orchestrator (T53 re-run) | Second probe run under the PD-16 conditions. The Product Owner places the free-plan token again. At most 30 requests: CL current league-phase matchday 1 with diagnostics; ELC stage discovery; PD, BL1, SA and FL1 matchday 1 with standings. Output a new findings file (for example `docs/work-items/WI-1/research/football-data-capabilities-2.md`) with its marker-scan evidence. Then an architect addendum to this document updates sections 2.2, 2.4 and 7. | Findings file and evidence only | After FU-2 (and FU-4 if applied first). Needs the Product Owner's action |
| FU-4 | Configuration correction (owner of `config/*.json`, re-plan) | `config/live.config.json`: add `"maxResponseBytesByResource": { "stageDiscovery": 1048576 }` to the football-data source options. Update the test that asserts no override. | `config/live.config.json`, `apps/server/src/providers/sports/adapters/football-data/live-config.test.ts` | When FU-3 confirms `too_large` (or earlier at the Orchestrator's choice). Within the reviewed 2 MiB bound (Q8, T11H-F20), so no new review |
| FU-5 | T49 correction, backend-developer | `ANONYMOUS_CLIENT_MARKER = 'anonymous'`, with its source noted as documentation and not yet observed. Add a test that a 403 carrying that value is `access_refused`. | `apps/server/src/providers/sports/adapters/football-data/constants.ts`, `apps/server/src/providers/sports/adapters/football-data/errors.test.ts` | Now or with FU-1. Stricter classification only (T11H-F04) |
| FU-6 | T49 correction or escalation | Fix the CL league-phase selection failure once FU-3 names the failing path. An adapter mapping defect is fixed in `mapping.ts`. A shared domain rule, such as the team-name characters in `packages/contracts/src/http/primitives.ts` and the http-api contract `TeamName` pattern, is a security-control and contract change: architect, security reviewer and Contract Safety. | `apps/server/src/providers/sports/adapters/football-data/mapping.ts` and its tests; otherwise to be planned | After FU-3. Above LOW if a shared rule is involved |
| FU-7 | Documentation, architect and product-manager | Record the confirmations of section 2.4 in `contracts/provider-ports.md` section 1.4 (items 1 to 5, 8, 9, 12, 13) and U-20. Correct `architecture-delta.md` section 11.10: the terms are published on /about, with attribution clause 7.1. Product-manager: correct the outdated assumption R-316 and the source note of R-312 to R-314 (terms and attribution now published; republishing still not stated). | `docs/work-items/WI-1/architecture/contracts/provider-ports.md`, `docs/work-items/WI-1/architecture/architecture-delta.md`, `docs/work-items/WI-1/requirements.md`, `docs/work-items/WI-1/requirements.json` | Any time. MED-05 |
| FU-8 | Design, architect (after DR-3 is answered) | If the provider's written reply confirms the clause 7.1 attribution, make it template text for LIVE_DATA content from that source. Where it appears (caption or closing slide) is a Product Owner content choice, and a per-source attribution setting would be an additive configuration change. | To be planned (content templates and configuration schema) | After the PD-18 reply. Not needed before, because LIVE_DATA content is not publication-approvable until then |

## 9. Product Owner decision request (batched by the Orchestrator)

### DR-1: approval of a secondary verification source (R-432; PD-01, PD-02; HIGH-05, HIGH-07)

- Context: section 3 and section 6.1. No candidate has captured coverage of the demonstrated competitions together with a demonstrable independence from football-data.org.
- Options:
  - (a) No secondary source in WI-1: LIVE_DATA facts stay UNVERIFIED "awaiting independent verification" (current design).
  - (b) Option (a), plus further public research (no account) of the Sportmonks free tier and a new capture attempt for API-Football, followed by a new decision.
  - (c) Approve Sportmonks now. This needs an account, possibly EUR 29 per month, a new adapter, a security review and a PD-15 decision, with independence unproven.
- Recommendation: (b), which includes (a) for WI-1.

### DR-2: costs that would need authorization (R-111)

- Under the recommendation, nothing in WI-1 needs payment.
- Costs that the options above or later steps would imply:

| Item | Cost as captured | Notes |
|------|------------------|-------|
| Sportmonks Starter | EUR 29/month (EUR 24 yearly) | A free tier exists (coverage UNVERIFIED). Its free tier and its 14-day trial also need an account, which needs authorization. |
| football-data.org paid columns | EUR 49, 99, 199 | Not needed. The free plan reads CL and PL. A paid plan also requires a PD-16 re-raise. |
| A hosted AI API | Amount UNVERIFIED | |

- Requested: confirm that nothing is authorized now, or authorize named items.

### DR-3: facts for requesting football-data.org's written republishing permission (PD-18; R-430, R-078)

- Published contact route (C1):
  - info@football-data.org, listed for terms;
  - daniel@football-data.org, the general contact and owner;
  - billing@football-data.org, which handles upgrades only.
- Operator: Freitag Web Tec UG, Oberweg 5, 35469 Allendorf (Lumda), Germany.
- Published terms relevant to the request (C1, effective 2018-06-01, Dutch law): 2.3 (one key per application), 3.x (fair use), 7.1 (attribution), 9.1 (no reference to the data after cancellation), 9.2 (logos belong to their owners) and 11 (amendments at any time).
- Uses the request should cover (to be confirmed by the Product Owner):
  1. The derived facts: final scores, match dates and kickoff times, match statuses, team names as text, standings tables (position, played, won, drawn, lost, goals for and against, goal difference, points), matchday or stage context, and competition and season names.
  2. The medium: Instagram carousel images (1080 x 1350) and captions, in Spanish and English, published manually by the operator. Exports and history are kept locally without expiry (OD-08).
  3. The competitions: the free-tier competitions read by the token (CL as reference, plus the second LIVE_DATA competition).
  4. Access: one free-plan key in one local application (2.3).
  5. Whether the social account is commercial. The research does not know; the Product Owner states it, and the request should ask whether the free plan covers that use.
  6. How clause 9.1 applies to posts already published and to the local history if the account is ever cancelled.
  7. No logos are used (PD-03, clause 9.2).
- Attribution requirement found: clause 7.1, "Football data provided by the Football-Data.org API", in a visible location. Ask where it must appear for images and captions; the confirmed wording becomes template text (FU-8).
- Optional question, for DR-1: which upstreams football-data.org uses, so that the independence of a secondary source can be assessed (R-047).
- Recording: the written reply is recorded as a Product Owner decision. Then the owner of `config/live.config.json` sets `publicationPermission: "confirmed"` and `publicationPermissionDecision: "PD-<n>"` for the football-data source (T17 rules).

### DR-4: fallback when no official source permits automated access (U-08; plan section 8; HIGH-07)

- Context: no automated channel was found for UEFA (terms not captured, data loaded by script) or the Premier League (prior written approval required for re-use; database creation prohibited). Other organisers were not captured.
- Options:
  - (a) For WI-1, the consultation step of PD-02 is not automated. A disagreement between two accepted sources stays UNVERIFIED until a later retrieval shows agreement (R-423). The operator may read the official page, but MANUAL_DATA never counts as accepted (R-071).
  - (b) The Product Owner seeks written permission or an official data channel from the organisers.
  - (c) Scraping official pages. Not proposed: it conflicts with the plan's limits and risks breaching terms.
- Recommendation: (a) now, with (b) as an optional later step.

### DR-5 (information): demonstration set (OD-22, R-440)

- PL is fully confirmed as the second LIVE_DATA competition. The CL league-phase matchday selection is not yet confirmed (section 2.2).
- Until FU-6, the two confirmed LIVE_DATA competitions are PL and BSA.
- A second probe run (FU-3) needs the Product Owner to place the free-plan token again.

## 10. Confirmation statements

- R-242:
  - The research covers pricing, coverage, reliability and redistribution or licensing for each candidate, as far as public captures allow. Every gap is marked UNVERIFIED with its reason (notably API-Football, UEFA terms and the national organisers, which were not captured).
  - Development and automated tests need no purchased service or subscription. They run on DEMO_DATA fixtures, MANUAL_DATA imports, the stub AI adapter and a replay egress client. No configured gate contacts a sports-data or AI provider (project configuration, `localEnvironment.notes`).
  - Nothing was purchased, subscribed to or upgraded, and no account, trial or key request was made for any candidate.
- R-281:
  - The provider findings record (section 2.1) lists competition availability, coverage, seasons, rate limits, freshness, commercial use, republishing and attribution. Each item is sourced and dated, or marked UNVERIFIED.
  - No subscription was purchased or upgraded. The T53 run used the Product Owner's token, which the Product Owner stated to be a free-plan token. This research did not verify the plan independently.

## 11. Conflicts and outdated statements

- R-316 (requirements, level 5) and `architecture-delta.md` section 11.10 (level 3) state that football-data.org publishes no terms and no attribution requirement. The T13 capture C1 shows the terms on /about, including attribution clause 7.1. This is not a conflict between decisions: those statements recorded the outcome of an earlier review whose factual basis the newer evidence corrects. Republishing is still not stated, so R-316's consequence (not confirmed) and PD-18 stand. Corrections go to FU-7. The `provider-research-plan.md` sections 3 and 4 wording "none published" is outdated in the same way.
- The Orchestrator's note in P says the "combined filter" `stage` plus `matchday` failed. The adapter sends only `matchday` for a matchday selection, and the provider answered with status 200 (section 2.2). The failure is in the platform's domain validation, not in a provider filter.
- The coverage page lists 12 free-tier competitions without CLI, while the token listed and read 13 competitions including CLI (C4 against P). This is recorded as an observation; there is no decision impact.

## 12. Analysis choices (LOW, inside this document)

1. The T53 request-level reconstruction (section 2.2) is derived from the counts in P and labelled as an inference.
2. Paraphrased capture text is treated as indicative; only quoted text is quoted.
3. The S-004 named domestic leagues are ranked first; BSA is listed separately as "other supported".
4. Candidates whose independence from football-data.org is unproven get the `football-data` independence group until the Product Owner accepts an argument (application of OD-24).
5. A value of 1 MiB is proposed for the stage-discovery override, derived from the measured bytes per match. The Orchestrator decides.
6. Enterprise providers and the organisers other than UEFA and the Premier League are listed as gaps, not analysed.
7. The source tags C1 to C19 and P are local to this document.
