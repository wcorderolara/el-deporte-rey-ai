# WI-1 Provider Research: Findings and Recommendation (PD-01, PD-12, R-136, R-242, R-281, R-432, R-440)

- Author: architect (task WI-1-T14). Date: 2026-10-28. Status: proposed analysis (precedence level 3 for the technical findings). Every choice in section 9 belongs to the Product Owner. This document selects, buys, subscribes to and upgrades nothing.
- Deliverable of `provider-research-plan.md` section 6. Acceptance criteria: R-242 and R-281. Also covers the confirmation parts of R-136 and R-259, R-432, R-440 (OD-22), OD-24 and the T11H assumptions NV-7, NV-8 and NV-10.
- Evidence used: only the T13 captures under `docs/work-items/WI-1/research/` and the T53 probe findings `research/football-data-capabilities.md`. The configuration and adapter code were read for reference only. A statement these inputs do not support is marked UNVERIFIED, with the reason.
- No legal assessment. Terms are quoted or paraphrased with their location. Whether a use is allowed is a question for the Product Owner (HIGH-05). This document names no AI model.
- Addendum (architect, task WI-1-T62, 2026-10-28; OD-60): updates from the second probe run (source tag P2, T61) are marked "Update (T62)" in sections 2.1, 2.2, 2.4, 2.5 and 7; the outcome of PD-21 to PD-24 is in section 9; the FU-6 decision request, the T60 findings to carry and the new follow-ups are in section 13. The text written by T14 is kept as history where an update supersedes it.

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
| P2 | `football-data-capabilities-2.md` (T61, PD-24) | origin https://api.football-data.org (the only origin contacted) | run started 2026-10-28T21:36:40Z | completed; 27 of at most 30 requests, all status 200, no 429; `--candidates CL,ELC,PD,BL1,SA,FL1`; probe with the T59 diagnostics reviewed by T60 (verdict PASS, conditions C1 to C8); free-plan token as stated by the Product Owner; marker scan `real token checked: yes`, 0 findings (evidence `T61-marker-scan-real.txt`) |

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

Update (T62, from P2, 2026-10-28):
- Competition availability (token): the details of CL, ELC, PD, BL1, SA and FL1 were read again (6 of 6 readable). ELC, PD, BL1, SA and FL1 report 10, 95, 64, 95 and 83 seasons, as in P. WC and the readability of CLI matches stay UNVERIFIED (not requested).
- Coverage per competition: ELC, PD, BL1, SA and FL1 now have a full current-season matchday-1 selection with standings (section 7). ELC stage discovery succeeded under the 1 MiB `stageDiscovery` cap (section 2.4 item 10). CL is unchanged in substance: whole-stage selection works, the league-phase matchday selection is refused by the shared team-name rule (section 2.2).
- Rate limits (observed): 27 requests paced at 10 per minute, no 429. `X-RequestCounter-Reset` 57 to 60 seconds on 27 responses. `X-RequestsAvailable` not seen on any of them (56 responses over both runs). NV-10 stays UNVERIFIED.
- Person data: `matches[].referees` again among the dropped keys of both match-list kinds.
- Republishing, attribution, terms: no new capture; the T14 findings stand (PD-18 stands, section 9).

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

#### 2.2.1 Update (T62, from P2): the failing rule is the shared team-name rule

Request accounting of P2 (from the counts in P2; every request had status 200, so the reconciliation is exact): 1 competition list; 6 detail requests (CL, ELC, PD, BL1, SA, FL1); 7 season-wide match lists (CL 2026/27, CL 2025/26, ELC, PD, BL1, SA, FL1); 7 selection match lists (CL league-phase matchday 1, CL 2025/26 `FINAL` as a whole, and matchday 1 of the five domestic leagues); 6 standings requests (CL matchday 1 and the five domestic leagues). Total 27.

Inferences from the counts (labelled as such, not recorded per request):
- Season-wide lists: 2,257 matches = CL 2026/27 144 (36 teams, 8 matchdays) + CL 2025/26 189 (144 league phase, 16 play-off, 16 last 16, 8 quarter-final, 4 semi-final, 1 final) + ELC 552 + PD 380 + BL1 306 + SA 380 + FL1 306. `matchday` is absent on 1 of 2,257 (the CL 2025/26 final).
- Selection lists: 69 matches = CL matchday 1 18 + CL final 1 + ELC 12 + PD 10 + BL1 9 + SA 10 + FL1 9. So the CL league-phase list returned 18 matches with status 200 and passed the adapter's allow-list schema.
- Standings: 6 responses, 18 tables, 408 rows. The five domestic leagues account for 15 tables and 300 rows (TOTAL, HOME, AWAY of 24, 20, 18, 20 and 18 rows). The CL response therefore returned 3 tables of 36 rows each with status 200. `standings[].stage` was present on all 18 tables and `standings[].group` on none.

What failed, now diagnosable without a value (FU-2, T59; reviewed by T60):
- "Filter stage LEAGUE_STAGE, matchday 1: failed (invalid; domain validation on selection, path /teams/29/name)". The rejection table of P2 holds this one entry.
- The stage is the shared domain validation of the selection snapshot (`validateSelectionSnapshot`), not the adapter's allow-list and not the provider: both provider responses were accepted with status 200 and passed the allow-list schemas.
- The path names the `name` of the 30th team of the snapshot's `teams` array. The only rule on that field is the shared team-name rule: the domain schema `DomainTeamNameSchema` is the contract's `TeamNameSchema` (`packages/contracts/src/domain/rules.ts`), pattern `^[\p{L}\p{M}\p{N} .'&()-]{1,64}$` with the Unicode flag, minimum 1 and maximum 64 (`packages/contracts/src/http/primitives.ts`, contract `components.schemas.TeamName` in `contracts/http-api.openapi.yaml`). This is the T10-F06 rule recorded in `contracts/provider-ports.md` section 1.3.
- So the failure is not an adapter mapping defect: the adapter copies `homeTeam.name` and `awayTeam.name` unchanged, as it must (R-052, R-237). It is the FU-6 "shared domain rule" case. The application refuses the selection with `invalid` and stores nothing (fail closed).
- Which character or which length fails is UNVERIFIED: the value was not recorded, by design (T11H-F02), and the diagnostic names the field, not the failing part of the rule (T59 note). Possible causes, none evidenced: a character outside the set (for example `/`, a typographic apostrophe U+2019, a non-breaking space U+00A0, a middle dot, a comma), a format character, or more than 64 characters. As an illustration only: a Norwegian club usually written with a `/` in its name ("Bodø/Glimt") played recent league phases; whether it is in the 2026/27 league phase and how the provider writes its name are not in any capture of this work item (UNVERIFIED).
- Only the first validation issue is reported. Whether the other rules of the snapshot (standings arithmetic and contiguity of a 36-row table, references of section 1.3 of `contracts/provider-ports.md`) hold for CL, and whether the CL TOTAL table is attributed to `LEAGUE_STAGE`, stays UNVERIFIED.
- The five domestic league selections passed the same rule. Each matchday-1 selection holds every team of the league (12 matches for 24 teams; 10 for 20; 9 for 18) and the standings hold every team, so every current-season team name of ELC, PD, BL1, SA and FL1, as the provider writes it, passes the rule today.

Confirmed for CL in P2: listed and readable (47 seasons); 2026/27 one stage `LEAGUE_STAGE`, matchdays 1 to 8, standings `expected`; 2025/26 six stages with the FU-1 rule applied (`LEAGUE_STAGE` standings `expected`; `PLAYOFFS`, `LAST_16`, `QUARTER_FINALS`, `SEMI_FINALS` matchdays 1 to 2 with standings `unknown`; `FINAL` without a matchday number, selectable as a whole, standings `unknown`); whole-stage selection of the 2025/26 `FINAL`: 1 finished match, standings `not_provided_for_stage`.

Status of the steps above: step 1 (FU-2) done by T59 and T60; step 2 (FU-3) done by T61; step 4 (FU-1) done by T59 and observed in P2; step 3 (FU-6) is the shared-rule case and needs a Product Owner decision (section 13.1). Until it is decided and applied, CL is usable in LIVE_DATA only for whole-stage selections (for example the 2025/26 final). CL knockout matchday selections were not probed; they involve teams of the league phase and may meet the same refusal (UNVERIFIED).

### 2.3 Other observations

- `X-Authenticated-Client` was present on every 2xx response, with one value throughout (presence booleans only; the value was never recorded). No 403 was observed (section 2.5, NV-8).
- Response sizes (largest decoded body per resource kind):
  - competition list: 5,647 bytes;
  - competition detail: 22,641;
  - season-wide match list: 384,639;
  - selection match list: 18,748;
  - standings: 28,268.

  All are below the 512 KiB cap. A refused (oversize) response is not measured (section 2.5, NV-7).

  Update (T62, P2): competition list 5,647; competition detail 15,292; season-wide match list 537,320 (above 512 KiB, accepted under the 1 MiB `stageDiscovery` cap); selection match list 18,748; standings 28,268. No egress refusal occurred.
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

#### 2.4.1 Update (T62, from P2)

| # | Result after P2 | Evidence | Status |
|---|-----------------|----------|--------|
| 1 | Confirmed again: `id`, `code`, `name`, `area.name` always present (13 of 13) | P2, `GET /competitions` | Confirmed; recorded in `contracts/provider-ports.md` section 1.4 (FU-7, T62) |
| 2 | Confirmed again: `stage`, `utcDate`, `status` (and `id`) always present on 2,257 of 2,257 season-list matches; `matchday` on 2,256 (absent only on the CL 2025/26 final, offered as a whole stage) | P2 | Confirmed; recorded (FU-7) |
| 3 | Confirmed again on 69 selection-list matches in 7 lists (CL matchday 1 and final, five domestic matchday-1 lists): `homeTeam` and `awayTeam` `id`, `name`, `shortName`, `tla`, and `score.fullTime.home` and `.away`, always present. All 69 were finished; the null scores of unfinished matches are still not observed | P2 | Confirmed for finished matches; recorded (FU-7) |
| 4 | Corrected rule applied and observed: CL 2025/26 knockout stages (matchdays 1 to 2 each) now carry standings `unknown`; `LEAGUE_STAGE` alone is `expected`; the probe count "Stages other than the table stage carrying matchday numbers" is now 4 (the T53 artefact is gone). Single-stage domestic seasons keep `REGULAR_SEASON` `expected` | P2; FU-1 (T59) | Closed |
| 5 | `standings[].stage` present on 18 of 18 tables, `standings[].group` on none. Attribution to the selection's stage confirmed for `REGULAR_SEASON` on seven leagues (BSA and PL in P; ELC, PD, BL1, SA and FL1 in P2: 24, 20, 18, 20 and 18 rows). For CL `LEAGUE_STAGE` still UNVERIFIED: the selection was refused by domain validation (section 2.2.1), although the CL standings response returned three 36-row tables (inference) | P2 | Confirmed for `REGULAR_SEASON`; `LEAGUE_STAGE` waits for FU-6 |
| 6 | Still UNVERIFIED: no match decided after extra time was in any selection | P2 (dropped keys only) | Unchanged |
| 7 | Still UNVERIFIED: no 403 in the 56 HTTP responses of both runs | P; P2 | Unchanged |
| 8 | The documented marker `anonymous` is now the adapter constant (FU-5, T59; source: documentation); still not observed, since every request was authenticated | C8; P2 | Unchanged as evidence; design applied |
| 9 | `X-RequestCounter-Reset` observed again (57 to 60 seconds, 27 responses); `X-RequestsAvailable` not observed on any of the 56 responses of the free-plan token over both runs | P; P2 | Unchanged; the local window remains the control |
| 10 | Largest season-wide match list 537,320 bytes, above 512 KiB and within the 1 MiB `stageDiscovery` cap; no egress refusal. By inference it is the ELC list (552 matches, about 973 bytes per match; every other season list holds at most 380 matches). This confirms the T53 `too_large` reading for ELC (NV-7) and resolves T60-F04 by measurement. The 1 MiB value is kept, not lowered: it leaves about 1.95 times the measured size for longer seasons or added play-off rounds, and stays within the reviewed 2 MiB bound (Q8, T11H-F20) | P2 (C8) | Closed (FU-4 confirmed) |
| 11 | Still UNVERIFIED | C5 | Unchanged |
| 12 | Confirmed again: `currentSeason`, `currentSeason.currentMatchday` (6 of 6 details), `seasons[].startDate`, `seasons[].endDate` (394 of 394 seasons) | P2 | Confirmed; recorded (FU-7) |
| 13 | Confirmed again: every row field always present (408 of 408) | P2 | Confirmed; recorded (FU-7) |
| 14 | No 404 in P2 | P2 | Unchanged |
| 15 (new) | Real CL league-phase team names against the shared team-name rule: at least one of the 36 names of 2026/27 fails it (path `/teams/29/name`); the failing part is UNVERIFIED | P2 | FU-6, Product Owner decision (section 13.1) |

### 2.5 T11H answers

- NV-7 (largest response size per resource kind; Q8): measured sizes are in section 2.3. All are below 512 KiB. One season-wide match list (ELC, current season) was refused by the egress client without an HTTP status. For the pinned origin, the possible refusals are oversize and redirect. The probe records only the closed code, so which one occurred is UNVERIFIED. Oversize is the likely cause: a 380-match season list (BSA, PL) measured 384,639 bytes, about 1,012 bytes per match, so a season list of more than about 518 matches exceeds 512 KiB. ELC's match count is not in the evidence. Follow-up FU-4: in `config/live.config.json`, set `maxResponseBytesByResource.stageDiscovery` to 1,048,576 bytes (1 MiB), which is within the T11H-reviewed maximum of 2 MiB. Apply it when FU-3 confirms the oversize refusal, or earlier at the Orchestrator's choice.
- NV-8 (`X-Authenticated-Client` presence booleans, anonymous marker; never a value):
  - present on 2xx responses: yes;
  - the same value on every response that carried it: yes;
  - present on 403: no 403 observed (UNVERIFIED).

  The anonymous marker "anonymous" is documented (C8) but not observed. Follow-up FU-5 sets the adapter constant `ANONYMOUS_CLIENT_MARKER` to `'anonymous'` from the documentation (T11H-F04). This makes the classification stricter: a 403 carrying the anonymous marker becomes `access_refused` instead of `not_available`.
- Update (T62): NV-7 is answered by measurement in P2. ELC stage discovery succeeded with the 1 MiB cap set by T59 (FU-4), and the largest season-wide list measured 537,320 bytes (section 2.4.1 item 10). NV-8 and NV-10 are unchanged by P2 (no 403; one token, one client; `X-RequestsAvailable` not observed).
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

### 7.1 Update (T62, from P2)

Every named S-004 domestic example is now confirmed end to end on the free plan: the current-season (2026/27) matchday-1 selection returned all matches finished with full-time scores, standings were available with a TOTAL table attributed to `REGULAR_SEASON`, and the selection passed the shared domain validation.

| Rank | Competition (code) | Confirmed coverage | Run |
|------|--------------------|--------------------|-----|
| 1 | Premier League (PL) | 2026/27 `REGULAR_SEASON` matchdays 1 to 38; matchday 1: 10 finished matches; standings 20 rows | P |
| 1 (tie) | Primera Division (PD) | 2026/27 `REGULAR_SEASON` matchdays 1 to 38; matchday 1: 10 finished matches; standings 20 rows | P2 |
| 1 (tie) | Serie A (SA) | 2026/27 `REGULAR_SEASON` matchdays 1 to 38; matchday 1: 10 finished matches; standings 20 rows | P2 |
| 1 (tie) | Bundesliga (BL1) | 2026/27 `REGULAR_SEASON` matchdays 1 to 34; matchday 1: 9 finished matches; standings 18 rows | P2 |
| 1 (tie) | Ligue 1 (FL1) | 2026/27 `REGULAR_SEASON` matchdays 1 to 34; matchday 1: 9 finished matches; standings 18 rows | P2 |

Outside the named examples: BSA (P) and ELC (P2: `REGULAR_SEASON` matchdays 1 to 46; matchday 1: 12 finished matches; standings 24 rows) are also confirmed end to end. EC has matches but its group standings returned 404 (P). DED, PPL and CLI are readable only (P).

Count: seven LIVE_DATA competitions have a working end-to-end matchday selection with standings (PL, PD, SA, BL1, FL1, BSA, ELC), so PD-14's "at least two LIVE_DATA competitions" is met on evidence. The five named leagues are equal on evidence; PL is listed first only because it was confirmed first (P, before the T59 changes; the other four in P2 with them). The Orchestrator chooses the domestic league at execution from the catalogue (OD-22), without any code or configuration change.

The reference CL: whole-stage selections work (2025/26 final). League-phase matchday selections are refused until FU-6 is decided and applied (section 13.1). So OD-22's set "CL plus one domestic league" can be demonstrated in WI-1 only with a CL whole-stage selection, unless the FU-6 fix is applied and confirmed in WI-1. This is information for the Product Owner, not a new decision; there is no upgrade path involved (PD-22).

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

Status after T62 (re-planned by OD-60):

| ID | Status |
|----|--------|
| FU-1 | Done by T59; observed in P2 (section 2.4.1 item 4) |
| FU-2 | Done by T59; security check T60 PASS (findings carried in section 13.3) |
| FU-3 | Done by T61 under PD-24 (P2) |
| FU-4 | Done by T59; confirmed by measurement in P2 (537,320 bytes; section 2.4.1 item 10) |
| FU-5 | Done by T59 (constant from documentation; still not observed) |
| FU-6 | Shared-rule case confirmed by P2; escalated to the Product Owner (section 13.1) |
| FU-7 | Architecture part done by T62 (`contracts/provider-ports.md` section 1.4, `architecture-delta.md` sections 11.8 U-20 and 11.10); requirements part done by T63 |
| FU-8 | Waits for the PD-18 reply; outside WI-1 unless it arrives (OD-60) |

## 9. Product Owner decision request (batched by the Orchestrator)

Outcome (T62 record of the Product Owner's answer to E-15, 2026-10-28; the decisions are in the tracker's Decisions table):

| Request | Decision | Outcome and effect |
|---------|----------|--------------------|
| DR-1 | PD-21 | Option (a), not the recommended (b): no secondary verification source in WI-1 and no further research of candidates in WI-1. Single-source LIVE_DATA facts stay UNVERIFIED "awaiting independent verification" (current design, R-055, R-432). Sections 3 to 6.1 stay as the record of the T14 research; the independence groups of section 5 are not configured for any candidate in WI-1 |
| DR-2 | PD-22 | Nothing is authorized: the football-data.org free plan stays; no account, trial, subscription or upgrade (R-111). No WI-1 task depends on a cost |
| DR-3 | Product Owner action (PD-18 stands) | The written republishing permission has not been recorded as of T62. LIVE_DATA content from football-data.org stays non-approvable for publication; FU-8 waits for the reply |
| DR-4 | PD-23 | Option (a): the official-publication consultation step of PD-02 is not automated in WI-1; a disagreement between two accepted sources stays UNVERIFIED until a later retrieval shows agreement (R-423); MANUAL_DATA never counts as accepted (R-071); no scraping |
| DR-5 | Information | Updated by P2: seven LIVE_DATA competitions confirmed end to end; CL league phase blocked by the shared team-name rule (section 7.1, FU-6) |
| FU-3 consent | PD-24 | Second probe run consented under the PD-16 conditions after the FU-2 diagnostics; run as T61 (P2). PD-24 covers that one run only (T60 condition C6); any further run needs the Product Owner again (section 13.1) |

The T14 text of the requests follows unchanged, as history.

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
  - Update (T62): the record is extended with the second run P2 (sections 2.1, 2.2.1, 2.4.1, 7.1), each item sourced and dated or marked UNVERIFIED. P2 used the same free-plan token as stated by the Product Owner, under PD-16 and PD-24; nothing was purchased, subscribed to or upgraded (PD-22).

## 11. Conflicts and outdated statements

- R-316 (requirements, level 5) and `architecture-delta.md` section 11.10 (level 3) state that football-data.org publishes no terms and no attribution requirement. The T13 capture C1 shows the terms on /about, including attribution clause 7.1. This is not a conflict between decisions: those statements recorded the outcome of an earlier review whose factual basis the newer evidence corrects. Republishing is still not stated, so R-316's consequence (not confirmed) and PD-18 stand. Corrections go to FU-7. The `provider-research-plan.md` sections 3 and 4 wording "none published" is outdated in the same way.
- The Orchestrator's note in P says the "combined filter" `stage` plus `matchday` failed. The adapter sends only `matchday` for a matchday selection, and the provider answered with status 200 (section 2.2). The failure is in the platform's domain validation, not in a provider filter.
- The coverage page lists 12 free-tier competitions without CLI, while the token listed and read 13 competitions including CLI (C4 against P). This is recorded as an observation; there is no decision impact.
- Added by T62: the requirements edge case "Long team names, accents or special characters: text-fit check; exact verified official name preserved" (requirements.md, R-037, R-052, R-213, R-237; level 5) against the shared team-name rule (approved contract `TeamName`, level 2; T10-F06 and `contracts/provider-ports.md` section 1.3, level 3). For a real name with a character outside the rule, the requirement asks for the exact name and the rule refuses it. By precedence the contract and the architecture govern: the selection is refused and the name is never altered. Whether to widen the rule is FU-6, a Product Owner decision (section 13.1); no source above level 2 decides it.
- Added by T62: the T61 Orchestrator note (P2) reads the CL failure as the shared-rule case. The evidence supports it (section 2.2.1): the path is the team `name`, whose only rule is the shared pattern, and the adapter copies the provider's name unchanged. No conflict.

## 12. Analysis choices (LOW, inside this document)

1. The T53 request-level reconstruction (section 2.2) is derived from the counts in P and labelled as an inference.
2. Paraphrased capture text is treated as indicative; only quoted text is quoted.
3. The S-004 named domestic leagues are ranked first; BSA is listed separately as "other supported".
4. Candidates whose independence from football-data.org is unproven get the `football-data` independence group until the Product Owner accepts an argument (application of OD-24).
5. A value of 1 MiB is proposed for the stage-discovery override, derived from the measured bytes per match. The Orchestrator decides.
6. Enterprise providers and the organisers other than UEFA and the Premier League are listed as gaps, not analysed.
7. The source tags C1 to C19 and P are local to this document.

Added by T62 (LOW, inside this document):

8. The T14 text is kept as history; updates are added as "Update (T62)" blocks and subsections (2.2.1, 2.4.1, 7.1) rather than rewritten in place, and the new source tag is P2.
9. The P2 request and match accounting (section 2.2.1) is reconstructed from the counts in P2 and labelled as an inference, as for P.
10. The largest season-wide list is attributed to ELC by inference from the match counts (section 2.4.1 item 10); the 1 MiB `stageDiscovery` value is confirmed, not lowered (the Orchestrator may still lower it within the evidence; T60-F04).
11. The five named S-004 leagues are ranked equal (section 7.1); PL is listed first only because it was confirmed first.
12. The follow-up IDs FU-9 to FU-15 (section 13.4) continue the FU numbering of section 8; they are proposals for the Orchestrator's re-plan, not task IDs.

## 13. Addendum (T62): FU-6 decision request, T60 findings and follow-ups

### 13.1 DR-6: CL league-phase team name refused by the shared team-name rule (FU-6; HIGH)

- Context (section 2.2.1): one of the 36 CL 2026/27 league-phase team names, as football-data.org writes it, fails the shared team-name rule, so every CL league-phase matchday selection is refused with `invalid` and nothing is stored. The rule is one schema used in three roles: the domain snapshot rule (`contracts/provider-ports.md` section 1.3), the approved http-api contract component `TeamName` (requests: manual import teams; responses: `TeamOfficialNameValue.officialName` and every fact or evidence value that carries it), and the T10-F06 security control that keeps structure-breaking characters out of the prompt data block and the rendered output. The failing character or length is UNVERIFIED.
- Why HIGH: any change to the rule changes the declared contract (`http-api`, `status: current`) and relaxes a security control (HIGH-03 "weakening any control"; HIGH-06 when Contract Safety fails). Keeping the rule leaves the reference competition of PD-12 unusable for league-phase matchdays in LIVE_DATA, which affects the OD-22 demonstration set. No existing source decides between them (section 11).
- Invariant in every option: an official name is never altered, abbreviated, transliterated or substituted (R-052, R-237, PD-06). A name the rule refuses is refused with its selection, never "fixed".

Options:

**(a) Widen `TeamName` by a closed, named list of punctuation found in real club names.**
- Change: the character class gains exactly L0 = { U+002F SOLIDUS `/`, U+2019 RIGHT SINGLE QUOTATION MARK `’` }. Proposed pattern `^[\p{L}\p{M}\p{N} .'’&()/-]{1,64}$` (length unchanged), description updated to name both characters, new `info.version` (for example `1.1.0`) and a new recorded hash. Any further character needs a new Product Owner decision. Renderer, UI text rendering, markup escaping, content checks and visual QA stay unchanged.
- Why these two: `/` is already allowed in `DisplayName` and `StageName`, so it already flows through the same content, render, QA, export and UI paths (every season label such as `2026/27` contains it); `’` is the typographic form of the already allowed `'`. Neither is evidenced as the failing character (UNVERIFIED); section 13.2 says how the fix is confirmed.
- Contract Safety:

| Condition | Holds? | Evidence |
|-----------|--------|----------|
| CS-1 backward compatible | Uncertain | Requests accept a superset (compatible for every client). Responses may now carry values the `1.0.0` pattern refuses; a client that validates responses against `1.0.0` would refuse them. The only client, `apps/web`, is built from the same `@edr/contracts` package in this repository. The PD-11 list of additive changes (new optional request fields, new response fields, new operations, new problem codes) does not name a widened pattern |
| CS-2 within approved scope | Yes | PD-12 (CL reference), PD-14, R-052, R-237 and the requirements edge case for special characters in names |
| CS-3 preserves authorization boundaries | Yes | No operation, guard or identity change |
| CS-4 does not weaken any security control | No (not shown) | The pattern is the T10-F06 control; widening it relaxes the control by two characters. A security design review can show both characters inert in every sink, but until then the condition cannot be shown to hold |
| CS-5 does not change business-rule semantics | Yes | No verification, approval, publication or identity rule changes; R-052 and R-237 are met for more real names |

  Classification: HIGH-06 (CS-4 not shown; CS-1 uncertain), overlapping HIGH-03. Not MED-01.
- Security impact on T10-F06 and the render path:
  - Structure: neither character is markup- or syntax-significant in HTML text, SVG text nodes (Satori), JSON, `caption.txt`, CSV or the prompt data block. `:`, `<`, `>`, `{`, `}`, `;`, `=`, `@`, `#`, `"` and backticks stay refused, so `://`, tags, placeholders (`{{...}}`), mentions and hashtags cannot be formed inside a name.
  - T10-F06 residual R4 (instruction text written with allowed characters) is unchanged in kind: plain words already pass. `/` adds path-like fragments without a scheme (`a/b`); the content checks must still treat a verified name as a name (test, not a rule change).
  - Render path: no change. Names reach Satori as text content (T10-F09 markup test), the UI renders text only, the export manifest is serialized JSON. The bundled fonts (OD-52) must contain both glyphs; a test of `layoutText` and the rendered PNG with both characters confirms it (a missing glyph would be a text-fit or visual-QA failure, so it fails closed).
  - Content checks and visual QA: tests that a verified name with `/` or `’` is not flagged by `FORBIDDEN_CONTENT` (URL detection), `capitalized_tokens` (OD-26; the token after `/`) or `NON_OFFICIAL_TEAM_NAME`, and that the hashtag-safe form drops both characters (rule unchanged).
  - Homoglyph pair `’` and `'`: two names that differ only in the apostrophe are different strings. `NON_OFFICIAL_TEAM_NAME` flags the non-identical form (fail closed), and cross-source identity matching may leave the team unmatched, so its facts stay unverified (fail closed). No identity rule change is proposed.
  - MANUAL_DATA: the same rule governs manual imports and form entry, so the operator can enter both characters; team keys derived by the T11H-F09 rule turn them into `-` (no new collision class).
  - Probe diagnostics: unaffected. Planted test names that use `/` or `’` to provoke a refusal must use a character that stays outside the rule (for example `“`), otherwise those tests change meaning.
- Exact reproduction (R-237): names containing only allowed characters plus L0 are reproduced exactly; names with any other character are still refused, never altered.
- Files and tasks (section 13.4): FU-11 (architect: proposed contract revision, delta with this assessment, provider-ports 1.3 text), FU-12 (security design review of the contract delta, `planning.md` section 4), acceptance under this decision when FU-12 passes, FU-13 (promotion and Zod mirror), FU-14 (render, content and QA tests), the Orchestrator's hash records in the configuration and the source of truth, and the confirmation run FU-15 (with FU-9 and FU-10 before it). T45 and T48 then depend on FU-13 and FU-14.
- Tradeoffs: CL league phase can be confirmed and demonstrated; cost is seven follow-ups, one more live run with the Product Owner's action, and a contract revision near the end of WI-1; the fix may still miss if the failing part is outside L0 or a length over 64 (then nothing more is widened without a new decision).

**(b) Keep the rule; refuse such selections.**
- Change: none. CL league-phase matchday selections stay unusable in LIVE_DATA (refused with `invalid`, nothing stored); CL stays demonstrable through whole-stage selections (2025/26 final); PD-14's two LIVE_DATA competitions are met by the seven confirmed leagues (section 7.1). The same refusal applies to any future name with such a character in any competition, LIVE_DATA or MANUAL_DATA.
- Contract Safety: no contract change (not applicable).
- Security impact: none; T10-F06 unchanged.
- Exact reproduction (R-237): no name is ever altered; the affected team names cannot be shown at all, which falls short of the requirements edge case for special characters (section 11).
- Files and tasks: none. FU-9 and FU-10 (the name-class diagnostic) are optional and only explain the refusal; no live run is needed.
- Tradeoffs: zero cost and fail closed; the PD-12 reference competition cannot produce its main content type (league-phase matchday carousels) from LIVE_DATA.

**(c) Admit the selection without the refused team (partial selection).**
- Change: the snapshot rule moves from all-or-nothing to per team: matches involving a team whose name fails the rule are excluded and labelled as excluded; the standings become unavailable (a table without a team is not the official table, and positions would not be contiguous).
- Contract Safety: needs a new availability or exclusion reason in the contract (additive enum value), but CS-5 fails (business-rule semantics of a selection, of standings and of R-069 "nothing filled or derived" change), so HIGH-06 together with HIGH-07.
- Security impact: the rule itself is unchanged (no weakening).
- Exact reproduction (R-237): no name altered, but the matchday is shown incomplete and a team silently missing from a carousel misstates the round unless the exclusion is labelled on the content.
- Files and tasks: `packages/contracts/src/domain/**`, `apps/server/src/providers/sports/ingestion/validation.ts`, the content and verification modules, the contract (new reason), the UI; a security review; a requirements update.
- Tradeoffs: CL league phase becomes usable without touching the security rule, at the cost of incomplete content and new business rules. Not recommended.

Considered and not proposed:
- An open set (every punctuation or symbol except a deny list): CS-4 clearly fails and the control loses its closed form.
- Normalizing or substituting the provider's name (for example `/` to `-`, `’` to `'`, a non-breaking space to a space) or a configured display alias: it alters the official name (R-052, R-237, PD-06).
- Widening only the internal domain schema and not the contract: the API would return values the declared contract refuses, against AD-04 (contract authoritative) and the conformance tests.
- Raising `maxLength`: only relevant if the diagnostic reports a length over 64; a separate decision then.

**Recommendation: (a) with exactly L0 = { `/`, `’` }, in WI-1, sequenced so that one further live run both confirms the fix and, if it does not, names the failing class without any value (section 13.2).** Order: Product Owner decision on this request and on the run (section 13.5) → FU-9 and FU-11 in parallel → FU-10 and FU-12 → FU-13 → FU-14 and FU-15. If the Product Owner prefers not to extend WI-1, choose (b) for WI-1 (current behaviour, fail closed, zero cost) and plan (a) in the next work item; CL is then demonstrated in WI-1 with a whole-stage selection.

### 13.2 Confirming the fix without recording a value

- Can it be confirmed without a live run? No. Only the provider's response, read with the Product Owner's token, holds the name as the provider writes it; unauthenticated access covers area and competition lists only (C6), and nothing in the repository may hold the value (T11H-F02, SC-04). PD-24 consented to one run (T61), and T60 condition C6 requires the Product Owner again for any further run. So confirmation needs a third run, which needs the Product Owner's consent under the PD-16 conditions (section 13.5).
- Name-class diagnostic (FU-9), the evidence the run records when a team name is refused:
  - Trigger: only a `domain validation` rejection whose reduced path ends in a team-name field (`/teams/<i>/name` or `/teams/<i>/aliases/<j>`).
  - Computed in memory by the adapter where it already observes the rejection, over every team name and alias of the rejected snapshot (not only the first issue): the number of names that fail the rule (capped at 99), a length class (`ok`, `empty`, `over_64`), and the sorted, de-duplicated set of at most four labels for the characters outside the rule. A label is a fixed name from a closed list in code (`solidus` U+002F, `right_single_quote` U+2019, `left_single_quote` U+2018, `double_quote_marks` U+201C or U+201D, `nbsp` U+00A0, `middle_dot` U+00B7, `comma`, `colon`, `semicolon`, `plus`, `underscore`, `fraction_or_division_slash` for U+2044 and U+2215), otherwise the two-letter Unicode general category of the character (a closed set of 30 values, for example `Po`, `Pd`, `Sm`, `So`, `Zs`, `Cf`).
  - Never recorded: the character itself (outside the closed list), its position, its count per name, its neighbours, the name, its length in characters, or the team index beyond the existing reduced path.
  - Output: one more closed line format after the existing diagnostic, for example `team-name rule: 1 name; length ok; outside solidus`. T60 condition C7 lists the reviewed formats; FU-10 extends that list.
  - Why it cannot carry a value: every element is a closed label, a closed category or a capped count; the set is sorted and capped, so order and multiplicity carry nothing; the probe re-closes every label against the same lists before writing (as T59 does for the refusal kind and the stage).
- One-run plan (FU-15, after FU-9, FU-10 and FU-13): `--candidates CL` only, about 7 of at most 30 requests (list, detail, two stage discoveries, CL matchday 1, the 2025/26 final, standings), with the T61 procedure and the T60 conditions as extended by FU-10. Outcomes:
  1. CL matchday 1 passes: the fix is confirmed without learning or recording which character it was, and the rest of the CL league-phase path (the 36-row standings table attributed to `LEAGUE_STAGE`, the referential rules) is confirmed at the same time (section 2.4.1 item 5).
  2. It fails with a name-class line: the class is known without a value. If it is outside L0 or a length over 64, nothing more is widened without a new Product Owner decision, and CL league phase stays refused (fail closed).
  3. It fails on another path: the reduced path names the next rule, as in P2.
- Under option (b) no run is needed; FU-9 and FU-10 may still be done to explain the refusal in a later run.

### 13.3 T60 findings carried

| Finding | Carry | WI-1 or later |
|---------|-------|---------------|
| T60-F01 (LOW): a token-shaped or data-valued provider key name can be printed whole on the "Dropped keys" line | Hardening in FU-9: print a dropped key only when it is at most 24 characters and not a long run of hexadecimal or base64-like characters (for example `^[0-9A-Fa-f]{16,}$`, or more than 16 alphanumerics without a separator), otherwise `<key>`; or print only names from a closed list of documented v4 field names (the reviewer's alternative, stricter; preferred, since every name seen in P and P2 is a documented field); a test with a planted token-shaped key. Files: `apps/server/src/providers/sports/adapters/football-data/observation.ts` (`SAFE_KEY`, `droppedKeyPaths`), `apps/server/scripts/football-data-probe.ts` (render), `apps/server/src/providers/sports/adapters/football-data/diagnostics.test.ts`, `apps/server/scripts/football-data-probe.test.ts` | In WI-1 only if another run happens in WI-1 (then before it, in FU-9). Otherwise in the next work item that runs the probe. Until hardened, T60 condition C7 (read of the "Dropped keys" lines after a passing scan) stays a mandatory run condition |
| T60-F03 (LOW, accuracy): diagnostics cut at 120 characters in the findings | In FU-9: render the diagnostic on its own line, or raise the cell limit for diagnostic cells to the 200-character path bound plus the prefix and the name-class suffix. Files: `apps/server/scripts/football-data-probe.ts` (`cell`, `failedText`), `apps/server/scripts/football-data-probe.test.ts` | Required with FU-9, because the name-class suffix makes the line longer; otherwise later (the P2 path `/teams/29/name` was far below the limit) |
| T60-F06 (LOW, maintenance): the path reduction is safe only while no schema of the diagnostic set is keyed by input data | A guard test that fails when any schema feeding `DIAGNOSTIC_FIELD_NAMES` uses `z.record`, `z.map`, `catchall`, `looseObject` or `passthrough`, plus a code comment naming the re-review trigger; optionally keep digits only where the schema position is an array. Files: `apps/server/src/providers/sports/adapters/football-data/observation.ts`, `apps/server/src/providers/sports/adapters/football-data/diagnostics.test.ts` | Can wait; cheap to add in FU-9 when FU-9 is done. Any task that adds a record-keyed schema to that set needs a security re-review regardless |
| T60-F04 (LOW) | Resolved by measurement (section 2.4.1 item 10): 537,320 bytes, 1 MiB kept | Closed |
| T60-F02 (INFO), T60-F05 (LOW, residual) | No action; F05 stays a residual covered by code and tests | - |

### 13.4 Follow-up tasks proposed (for the Orchestrator's re-plan; not edited here)

| ID | Agent | Change | Files owned | Depends on | Condition and level |
|----|-------|--------|-------------|------------|---------------------|
| FU-9 | backend-developer | Name-class diagnostic (section 13.2); T60-F01 hardening; T60-F03 diagnostic line length; T60-F06 guard test; planted test names that provoke a team-name refusal switched to a character outside both the current rule and L0 (for example `“`). Tests prove no name, character outside the closed list, token, header value, URL or score reaches findings, stdout, stderr or observations. No contract change, no live request | `apps/server/src/providers/sports/adapters/football-data/observation.ts`, `apps/server/src/providers/sports/adapters/football-data/provider.ts`, `apps/server/src/providers/sports/adapters/football-data/diagnostics.test.ts`, `apps/server/scripts/football-data-probe.ts`, `apps/server/scripts/football-data-probe.test.ts`, `fixtures/football-data/**` | DR-6 decided with a run (option a, or b with a diagnostic run) | MED-05 re-plan; probe output change, so FU-10 before any run |
| FU-10 | security-reviewer | Check of FU-9 as T60 did for T59: no value through the name-class line; dropped-key hardening; extended list of reviewed formats for condition C7; conditions for FU-15 | `docs/work-items/WI-1/security/review-<task>-probe-name-class.md` | FU-9 | Before FU-15 |
| FU-11 | architect | Proposed contract revision as a new file (the WI-1 proposal `contracts/http-api.openapi.yaml` in the architecture directory is history and not edited, source of truth section 6); `architecture-delta.md` section with the diff and the section 13.1 Contract Safety assessment; `contracts/provider-ports.md` section 1.3 team-name rule text | `docs/work-items/WI-1/architecture/contracts/http-api.openapi.1.1.0-proposed.yaml`, `docs/work-items/WI-1/architecture/architecture-delta.md`, `docs/work-items/WI-1/architecture/contracts/provider-ports.md` | DR-6 option (a) | HIGH-06 decided by DR-6 |
| FU-12 | security-reviewer | Security design review of the contract delta (`planning.md` section 4): T10-F06, the render path, content checks, visual QA, homoglyph handling, MANUAL_DATA entry, fonts; verdict | `docs/work-items/WI-1/security/review-<task>-team-name-charset.md` | FU-11 | Acceptance of the revision is conditional on PASS |
| FU-13 | backend-developer | Promotion: `TeamName` pattern and description, `info.version`, Zod mirror `ContractPatterns.TeamName`, contract parity and conformance tests, unit tests of the rule (L0 accepted; every other punctuation still refused; length unchanged); the purpose text of the `injection-rejected` fixture, which lists `/` among the rejected characters (the fixture still fails on `;`, `{`, `}`, `=`, `<`, `>`) | `contracts/http-api.openapi.yaml`, `packages/contracts/src/http/primitives.ts`, `packages/contracts/src/**/*.test.ts`, `apps/server/test/contract/**`, `fixtures/sports/_manifest.json`, `fixtures/fixtures.test.ts` | FU-12 PASS, FU-9 (planted names switched first) | Then the Orchestrator records the new hash in `.orchestrate/config.json` and source-of-truth section 6 (protected paths) |
| FU-14 | qa-engineer | Tests only: test-local synthetic snapshots (no new fixture scenario, so the fixture manifest stays with FU-13) with team names containing `/` and `’` through content (placeholders, `FORBIDDEN_CONTENT`, `capitalized_tokens`, `NON_OFFICIAL_TEAM_NAME`, hashtag-safe form), rendering (glyphs of the bundled fonts, text fit, PNG), visual QA and the export manifest (the web pages render names as text only and already have hostile-string tests); a defect found is reported, not fixed in this task | `apps/server/src/modules/content/**/*.test.ts`, `apps/server/src/modules/rendering/**/*.test.ts`, `apps/server/src/modules/visual-qa/**/*.test.ts`, `apps/server/src/modules/export/**/*.test.ts` | FU-13 | MED-05 |
| FU-15 | Orchestrator | Third probe run, CL only (section 13.2), T61 procedure and the FU-10 conditions; findings `docs/work-items/WI-1/research/football-data-capabilities-3.md`; evidence `T<n>-marker-scan-real.txt`; the Orchestrator records the outcome against section 13.2 (an architect addendum only if the outcome needs a design change) | `docs/work-items/WI-1/research/football-data-capabilities-3.md`, `docs/work-items/WI-1/evidence/T<n>-*.txt` | FU-10, FU-13 | Needs the Product Owner's consent and action (section 13.5) |

Parallel groups: {FU-9, FU-11}; {FU-10, FU-12}; FU-13; {FU-14, FU-15}. Critical path: FU-11 → FU-12 → FU-13 → FU-15 (FU-9 → FU-10 runs beside it). Owned files of tasks that can run at the same time are disjoint; FU-13 waits for FU-9 because the widened rule would accept the planted names (with `/` or `’`) that FU-9's and T59's tests expect to be refused, so FU-9 switches them first (FU-9 owns `fixtures/football-data/**` and the adapter and probe tests; FU-13 only `fixtures/sports/_manifest.json` and `fixtures/fixtures.test.ts`). Gates re-run by ID: FU-9 PRJ-TYPECHECK, PRJ-LINT, PRJ-UNIT, PRJ-INTEGRATION; FU-13 PRJ-CONTRACT, PRJ-CONTRACT-ID (after the Orchestrator's hash record), PRJ-UNIT, PRJ-INTEGRATION, PRJ-BUILD, PRJ-E2E; FU-14 PRJ-UNIT, PRJ-INTEGRATION; no gate is added and no gate uses the token (R-135, R-258).

Under option (b): none of FU-11 to FU-15; FU-9 and FU-10 optional (they belong to the next work item that runs the probe).

### 13.5 Product Owner decisions requested (to batch with DR-6)

1. DR-6 (FU-6): option (a), (b) or (c) of section 13.1; recommendation (a) with L0 in WI-1, or (b) for WI-1 if WI-1 is not to be extended.
2. Consent to a third probe run (CL only, at most 30 requests, the Product Owner places the free-plan token and starts the run, PD-16 conditions and the FU-10 conditions), needed only under option (a) in WI-1, or under (b) if the Product Owner wants the refusal explained. Precedent: PD-24. Recommendation: consent, together with (a).

No other decision is requested by this addendum.
