# WI-1 — Incremental Planning Update: Sports Data Provider

We have new Product Owner information after completing
the implementation plan.

Do not restart requirements analysis or recreate the
implementation plan.

Apply an incremental change to the existing WI-1 plan.

## Provider Selection

The Product Owner has selected football-data.org as
the preferred primary sports-data provider for the MVP.

Provider:

Name: football-data.org
API Version: v4
Base URL: https://api.football-data.org/v4

Official documentation:

https://www.football-data.org/documentation/quickstart/
https://docs.football-data.org/general/v4/index.html
https://docs.football-data.org/general/v4/lookup_tables.html#_response_headers

Initial competition:

UEFA Champions League
Competition code: CL
Competition ID: 2001

## Authentication

Use the environment variable:

FOOTBALL_DATA_API_TOKEN

Authenticate through the provider's X-Auth-Token header.

Security requirements:

1. Never hardcode API credentials.
2. Never commit credentials to Git.
3. Never expose credentials to the frontend.
4. Never include credentials in logs or test evidence.
5. Provide an .env.example without real credentials.
6. Ensure local credential files are Git-ignored.
7. Validate configuration at application startup.

Do not request the API token in this conversation.

## Architecture Requirements

Preserve the existing provider abstraction.

Implement football-data.org as the first concrete
sports-data adapter.

The architecture must allow future providers to be
added without changing the Research Agent's business logic.

Support:

- Competition discovery.
- Available seasons.
- Matchday selection.
- Match results.
- Match status.
- Team names.
- Standings.
- Source metadata.
- Data retrieval timestamps.

Validate actual API capabilities before promising
support for specific data fields.

## API Integration

Review the official documentation and identify the
endpoints needed for:

1. Competition information.
2. Competition matches.
3. Matchday filtering.
4. Season filtering.
5. Competition standings.

Implement:

- Runtime response validation.
- Provider-to-domain mapping.
- HTTP error handling.
- Timeouts.
- Bounded retries.
- Rate-limit handling.
- Request caching.
- Safe diagnostic logging.
- Deterministic test fixtures.

Read and respect the provider's rate-limit headers,
including:

X-RequestsAvailable
X-RequestCounter-Reset

Do not assume unlimited API access.

## Fact-Checking

Preserve the approved two-source verification policy.

football-data.org is the primary data source.

The Fact-Checking Agent must use an independent
accepted source for verification.

Until a secondary source is approved and available:

- Allow research using football-data.org.
- Mark results as awaiting independent verification.
- Do not mark those results as fully verified.
- Do not allow publication approval based solely
  on one source.

## Provider Availability and Licensing

Inspect the actual subscription capabilities.

Verify:

- Champions League availability.
- Match and standings coverage.
- Available seasons.
- Rate limits.
- Data freshness.
- Commercial usage conditions.
- Republishing restrictions.
- Attribution requirements.

Record verified findings with their sources.

Do not assume that API access grants permission
to redistribute all supplied content.

Do not purchase or upgrade subscriptions.

## Incremental Task Reconciliation

Inspect the existing 37 tasks, T12–T48.

Identify tasks affected by this provider selection.

For each affected task:

1. Preserve its existing task ID.
2. Update implementation instructions.
3. Update dependencies if necessary.
4. Update acceptance criteria.
5. Update test expectations.
6. Update provider configuration requirements.

Create additional tasks only when the existing tasks
cannot accommodate the change.

Do not recreate completed tasks.

Do not reset the existing tracker.

Preserve all previously recorded decisions and evidence.

## Testing

Keep deterministic fixtures as the default test mode.

Add contract tests for football-data.org responses.

Test:

- Valid API responses.
- Missing optional fields.
- Invalid API responses.
- Authentication failures.
- Rate-limit responses.
- Provider unavailability.
- Network timeouts.
- Cache behavior.
- Unavailable competitions or seasons.
- Missing standings.
- Incomplete matchdays.
- Provider data disagreements.

Live API integration tests must be optional and
must not expose credentials.

## Execution

1. Record this Product Owner decision.
2. Update requirements only where necessary.
3. Update the architecture delta.
4. Reconcile the existing implementation plan.
5. Update affected tracker tasks.
6. Run plan check.
7. Run requirements check.
8. Run tracker check.
9. Run orch validate.
10. Record all modifications and verification evidence.

Continue autonomously within the existing policies.

Do not begin implementation yet.
Do not merge into main.
Do not push or deploy.

## Expected Output

Report:

- Updated task IDs.
- New tasks, if any.
- Architecture changes.
- API endpoints selected.
- Rate-limit strategy.
- Provider coverage and licensing findings.
- Remaining dependencies.
- Final planning validation results.

# WI-1 — Additional Product Owner Requirement

Extend the existing data ingestion architecture to support
multiple data acquisition modes.

This is an incremental requirement.

Do not restart the implementation plan.

## Supported Modes

### LIVE_DATA

Retrieve sports data from external providers.

Initial provider:
football-data.org API v4.

### MANUAL_DATA

Allow the operator to provide sports information through:

- JSON files.
- CSV files.
- Structured data entered through the web interface.

The system must support competitions without public APIs.

Initial example:
Liga Nacional de Guatemala.

### DEMO_DATA

Use deterministic synthetic fixtures for development,
testing and demonstrations.

## Unified Data Model

All three modes must produce the same normalized
domain representation.

The downstream agents must remain independent
of the selected data source.

## Manual Import Requirements

1. Validate imported data against runtime schemas.
2. Provide clear validation errors.
3. Reject malformed or incomplete records.
4. Prevent duplicate match records.
5. Support competition, season and matchday metadata.
6. Support match results and standings.
7. Preserve the original imported data.
8. Record import timestamp and source metadata.
9. Allow correcting and reimporting data.
10. Never invent missing scores or standings.

## Verification and Approval

Distinguish:

- UNVERIFIED
- VERIFIED
- MANUALLY_APPROVED

Manual approval must never be represented as
independent factual verification.

Preserve source attribution and auditability.

## Architecture

Create a provider-independent ingestion interface.

Implement adapters for:

- FootballDataProvider
- ManualDataProvider
- FixtureDataProvider

All adapters must produce the same validated
domain representation.

## Execution

1. Update WI-1 requirements.
2. Update architecture and contracts.
3. Reconcile existing implementation tasks.
4. Add tasks only where necessary.
5. Preserve existing task IDs and evidence.
6. Update acceptance criteria and test coverage.
7. Run all planning and framework validation checks.
8. Report affected tasks and remaining dependencies.

Do not start implementation yet.
Do not merge into main, push or deploy.

Finish with WI-1 ready for:

/orchestrate:execute WI-1
