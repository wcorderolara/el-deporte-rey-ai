# WI-1 — Product Owner Scope Clarification

IMPORTANT: El Deporte Rey AI is a dynamic, multi-competition
sports content platform.

UEFA Champions League is only the initial validation scenario.

It must NOT be the only supported competition or a
hardcoded architectural dependency.

## Competition Support

The platform must dynamically support competitions available
through configured sports-data providers.

Examples include:

- UEFA Champions League
- Spanish La Liga
- English Premier League
- German Bundesliga
- Italian Serie A
- French Ligue 1
- Other supported competitions

These are examples, not a fixed allowlist.

## Dynamic Competition Discovery

The application must:

1. Retrieve available competitions from configured providers.
2. Display competitions in a selectable catalogue.
3. Allow selecting a competition.
4. Retrieve available seasons.
5. Retrieve available matchdays or equivalent stages.
6. Retrieve matches, results and standings.
7. Handle competitions with different tournament structures.
8. Detect unavailable competitions or unsupported features.
9. Handle subscription-specific access restrictions.
10. Avoid hardcoded competition IDs in domain logic.

Provider-specific IDs and codes must remain inside
provider adapters or configuration.

## Multiple Data Sources

Support:

- LIVE_DATA
- MANUAL_DATA
- DEMO_DATA

Manual competitions must appear in the same catalogue
as API-backed competitions.

A competition may have one or more configured data sources.

The source used must be recorded for traceability.

## Provider Independence

The domain model must not depend on football-data.org.

Define provider-neutral concepts for:

- Competition
- Season
- Stage
- Matchday
- Match
- Team
- Standing
- Source
- Verification status

Allow provider-specific extensions without contaminating
the shared domain contracts.

## User Experience

The operator must be able to:

1. Select a competition.
2. Select a season.
3. Select a matchday or stage.
4. Choose an available data source.
5. Retrieve results and standings.
6. Review source provenance and verification status.
7. Generate branded content.
8. Preview, approve and export the content.

The UI must not assume that every competition follows
the same format.

## Scope Clarification

The initial MVP must demonstrate:

A. At least two distinct LIVE_DATA competitions,
   subject to the configured provider's actual coverage.

B. One MANUAL_DATA competition.

C. One DEMO_DATA competition.

Champions League may be used as the primary reference
scenario, but all implemented workflows must be reusable
across competitions.

Do not expand the MVP into provider-specific features
that are unnecessary for this capability.

## Incremental Planning

Treat this as a clarification of the original product vision.

1. Update affected requirements.
2. Update architecture and domain contracts.
3. Reconcile existing tasks and dependencies.
4. Preserve existing task IDs, decisions and evidence.
5. Add or strengthen acceptance tests for multi-competition
   behavior and provider independence.
6. Verify that no core service hardcodes Champions League
   or football-data.org identifiers.
7. Run all planning and framework validation checks.

Continue autonomously within existing authorization.

Do not restart planning.
Do not implement application code yet.
Do not merge, push or deploy.
