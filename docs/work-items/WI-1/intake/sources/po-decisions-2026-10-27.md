The Product Owner approves the following decisions for WI-1:

R-410: Option C.
Use a licensed sports-data API as the preferred primary source
and an independent official source for verification.

The Architect must research available providers, pricing,
coverage, reliability and redistribution/licensing conditions.
Use synthetic fixtures during development.

Do not purchase or subscribe to services without authorization.

R-411: Option A.
Scores, match dates and standings require agreement between
two independent accepted sources.

If sources disagree, consult the official competition
publication. Do not mark disputed facts as verified until
the discrepancy is resolved.

R-413: Option C.
Use team names as text and existing authorized brand assets.
Reserve optional badge slots without using unauthorized logos.

R-414: Option A.
Limit the initial MVP to team-level and competition-level data.
Do not introduce player-level information.

R-415: Option A.
Single local operator without login.
Bind development services to localhost only.

R-416:
Language: Option C, Spanish by default.
Team names: Option i, preserve verified official names.

Additional Product Owner confirmation:

- Main branch: main.
- Frontend is required.
- Enable the frontend-developer role in the project configuration
  through the authorized configuration workflow.
- Preserve the proposed 1080x1350 carousel format.
- Preserve individual slide/caption approval and final approval.
- Preserve league-phase-only scope for the initial MVP.
- No automatic publication.

Execution:

1. Record all six Product Owner decisions.
2. Have the Product Manager update the requirements.
3. Verify traceability and acceptance criteria.
4. Update project configuration through the authorized workflow.
5. Run orch requirements check, tracker check and validate.
6. Commit the approved requirements changes to the work branch.
7. Report readiness for /orchestrate:plan WI-1.

Resolve routine implementation details autonomously.

Do not implement application features yet.
Do not merge into main, push or deploy.
