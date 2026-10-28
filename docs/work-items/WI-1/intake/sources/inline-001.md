# El Deporte Rey — AI Sports Content Platform

## Product Vision

Build an AI-assisted sports content production platform for
El Deporte Rey GT (@ElDeporteReyGT).

The platform will research sports events, verify factual data,
prepare social media content and generate professional visual
assets for publication.

The initial use case is UEFA Champions League matchday coverage.

## Primary Workflow

1. The user selects a competition, season and matchday.

2. A Research Agent retrieves:
   - Match results.
   - Teams and scores.
   - Match dates.
   - Competition standings.
   - Relevant competition context.

3. A Fact-Checking Agent independently verifies all factual
   information against reliable sources.

4. A Content Agent prepares:
   - Carousel structure.
   - Headlines.
   - Slide descriptions.
   - Social media captions.
   - Relevant hashtags.

5. A Graphic Design Agent creates:
   - Individual match-result slides.
   - Standings slides.
   - Cover slides.
   - Closing slides.

6. A Visual QA Agent verifies:
   - Scores and standings match verified data.
   - Team names are correct.
   - Text fits the layouts.
   - Visual consistency.
   - Social media dimensions.

7. The user reviews the generated carousel and captions.

8. Approved assets can be exported for manual publication.

## Functional Requirements

- Web interface for managing content projects.
- Competition, season and matchday selection.
- Research execution and progress tracking.
- Structured, traceable research results.
- Source attribution and factual verification.
- Reusable branded carousel templates.
- Preview and approval workflow.
- Regeneration of individual slides.
- Export of images and captions.
- History of generated content.

## Branding

Brand: El Deporte Rey GT

Social handle: @ElDeporteReyGT

Mascot: KETSI

Visual identity:
- Purple.
- Gold.
- Blue.
- White.

Support reusable brand assets and templates.

Do not assume logos, team badges or mascot images exist
unless they have been provided.

## Quality Requirements

- Never invent scores, standings or match statistics.
- Use trustworthy, attributable data sources.
- Clearly distinguish verified facts from AI-generated commentary.
- If facts cannot be verified, block publication approval
  for the affected content.
- Numeric information must be rendered deterministically.
- Generated visuals must preserve exact verified scores and names.
- Maintain traceability from source data to exported slides.
- Require explicit user approval before publication.
- Do not publish automatically during the MVP.

## Initial Scope

Develop a local-first MVP.

Prioritize:
1. One competition: UEFA Champions League.
2. Matchday results and standings.
3. Instagram carousel generation.
4. Manual approval and export.

Support future extension to additional competitions,
social platforms and automated publishing.

## Technical Direction

Allow the Architect to propose the technology stack
based on project requirements.

Prefer:
- Modular architecture.
- Strong runtime validation.
- Testable agent boundaries.
- Reusable templates.
- Provider abstraction.
- Automated testing.
- Local development.
- Configurable AI and sports-data providers.

Avoid unnecessary infrastructure and premature complexity.

## Orchestration

Use the installed ORCH-V3 framework.

Start with requirements analysis and normalization.

Generate:
- Product requirements.
- User stories.
- Acceptance criteria.
- Architecture considerations.
- Dependencies.
- Risks.
- Proposed MVP delivery phases.

Resolve routine technical decisions autonomously
within established project policies.

Do not begin implementation during this analysis phase.

Do not push or deploy.
