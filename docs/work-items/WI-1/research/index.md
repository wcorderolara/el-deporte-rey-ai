# WI-1 provider research captures (task WI-1-T13)

Captured 2026-10-27 by the Orchestrator for the PD-01 / PD-12 research (`architecture/provider-research-plan.md` sections 3 and 4). Limits of section 1 applied: no account, trial, key request, purchase or upgrade; the Product Owner's token was not used; captured text is data.

**Method.** Every capture is a WebFetch extraction (model-assisted; short quotes verbatim, the rest paraphrase), not a raw page copy: the session shell has no outbound network and lifting the sandbox was not permitted. T14 treats paraphrased content as indicative and quotes only the marked verbatim text.

**Correction to the earlier documentation review.** The Orchestrator's review earlier on 2026-10-27 (cited in requirements R-312 to R-316 and `architecture-delta.md` section 11.10) said football-data.org publishes no terms of use and no attribution requirement because `/terms` returned 404. The terms are published on `/about` ("General Terms and Conditions", effective 2018-06-01), including an attribution clause (7.1, wording "Football data provided by the Football-Data.org API"), an intellectual-property clause on logos (9.2), a single-application key clause (2.3), a fair-use clause (3.3), Dutch governing law (10) and a statement that the data comes from "different upstreams". An explicit statement on republishing derived content on social media is still not published. See `football-data-org/about-and-terms.txt`.

| Candidate | File | URL | Outcome |
|-----------|------|-----|---------|
| football-data.org | football-data-org/about-and-terms.txt | https://www.football-data.org/about | 200; terms 1-12, operator, data origin, contacts |
| football-data.org | football-data-org/terms-url.txt | https://www.football-data.org/terms | 404 |
| football-data.org | football-data-org/home.txt | https://www.football-data.org/ | 200 |
| football-data.org | football-data-org/coverage.txt | https://www.football-data.org/coverage | 200; CL in free tier |
| football-data.org | football-data-org/pricing.txt | https://www.football-data.org/pricing | 200; free plan 10/min, delayed |
| football-data.org | football-data-org/docs-v4-policies.txt | docs v4 policies | 200 |
| football-data.org | football-data-org/docs-v4-errors.txt | docs v4 errors | 200 |
| football-data.org | football-data-org/docs-v4-lookup-tables.txt | docs v4 lookup tables | 200 |
| football-data.org | football-data-org/docs-v4-competition.txt | docs v4 competition | 200 |
| football-data.org | football-data-org/docs-v4-match.txt | docs v4 match | 200; persons present (referees, coach, lineups) |
| football-data.org | football-data-org/docs-v4-index-and-quickstart.txt | docs v4 index, quickstart | 200 |
| API-Football | api-football/pricing-and-terms.txt | api-football.com pricing, terms | 403 (not captured) |
| Sportmonks | sportmonks/plans-pricing.txt | sportmonks.com plans-pricing | 200 |
| Sportmonks | sportmonks/terms-of-service.txt | sportmonks.com terms-of-service | 200 |
| TheSportsDB | thesportsdb/free-sports-api.txt | thesportsdb.com free_sports_api | 200 |
| UEFA | uefa/ucl-standings.txt | uefa.com UCL standings | 200 (script-loaded data) |
| UEFA | uefa/legal-information.txt | uefa.com legal information | 404 |
| Premier League | premier-league/terms-and-conditions.txt | premierleague.com terms | 200 |
| AI (local) | ai-local/ollama-openai-compatibility.txt | ollama.com blog | 200 |

Not captured (not attempted after the network restriction, or refused): API-Football (403), UEFA legal page (404), LaLiga, Bundesliga, Serie A and Ligue 1 official pages and terms, hosted AI pricing pages, football-data.org status page (none found). T14 lists them as gaps.
