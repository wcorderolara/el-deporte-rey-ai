# WI-1: El Deporte Rey GT AI sports content platform (MVP)

| Field | Value |
|-------|-------|
| Work item | WI-1 |
| Mode | full |
| Starting point | SP-1 (idea, inline text only); override: none |
| Records file | `docs/work-items/WI-1/requirements.json` |
| Intake record | `docs/work-items/WI-1/intake/intake-record.json` |
| Language | en |

## Sources

| Source ID | Path | Type | Precedence level | Hash |
|-----------|------|------|------------------|------|
| S-000 | `docs/work-items/WI-1/intake/sources/inline-001.md` | frd (inline record of the Product Owner launch text) | 1 | `b55dc299ab338c57d3555a183ccd11336c6f97bd79708a1f2737e7bdd6251aa2` |

All records cite S-000 by heading and line range. S-000 has no identifiers of its own, so every record has `originalId: null`. No other source was analysed; the project has no code, no contracts, no architecture and an empty source of truth.

Reading notes:
- The "Research Agent", "Fact-Checking Agent", "Content Agent", "Graphic Design Agent" and "Visual QA Agent" of S-000 are **product features** (stages inside the product), not framework roles (R-302).
- The "Orchestration" section of S-000 (lines 127-147) is process direction to the framework, not product requirements. It is listed in section 12.
- Where S-000 says the same thing more than once (for example reusable templates in lines 59, 79 and 119, or explicit approval in lines 60 and 94), the statements are merged into one record that cites every location. No source reference was dropped.

## 1. Business context

El Deporte Rey GT (social handle @ElDeporteReyGT, mascot KETSI) publishes sports content on social media. The Product Owner wants an AI-assisted platform that researches sports events, verifies the facts, prepares social media content and generates professional visual assets for publication (S-000 lines 5-10, 67-71). The first use case is UEFA Champions League matchday coverage (line 12), delivered as a local-first MVP that produces Instagram carousels for manual publication (lines 99-105).

## 2. Problem statement

S-000 states no explicit problem. Derived from the vision and the quality requirements (lines 5-10, 86-95): the brand needs matchday coverage content that is produced quickly, looks professional and consistent, and never contains invented or unverified scores, standings or names, with every published fact traceable to an attributable source and nothing published without explicit human approval.

## 3. Personas

| Persona | Description | Record |
|---------|-------------|--------|
| Content operator | The only platform user in the MVP ("the user" of S-000): creates projects, runs research, reviews, regenerates, approves and exports. | R-300 (assumption); authentication model open in R-415 |
| Audience (indirect) | Followers of @ElDeporteReyGT who see the manually published carousels. Not a platform user. | R-300 |

## 4. User stories

User stories are stored as functional records with the prefix "User story US-nn"; the functional requirements of section 5 refine them.

| Record ID | Story | Sources (S-000) |
|-----------|-------|-----------------|
| R-001 | US-01: As the content operator, I want to create a content project in a web interface by selecting a competition, season and matchday, so that the platform prepares coverage of that matchday. | Primary Workflow 16; Functional Requirements 54-55 |
| R-002 | US-02: As the content operator, I want the platform to research the selected matchday (results, teams and scores, dates, standings and competition context) and to show me the progress of the research, so that I receive structured, source-attributed data without collecting it by hand. | Primary Workflow 18-23; Functional Requirements 56-57 |
| R-003 | US-03: As the content operator, I want every fact to be verified independently against reliable sources and marked as verified or not verified, so that content with invented or unverified scores, standings or statistics cannot be approved. | Primary Workflow 25-26; Functional Requirements 58; Quality Requirements 86-90 |
| R-004 | US-04: As the content operator, I want the platform to draft the carousel structure, headlines, slide descriptions, social media caption and hashtags from the verified data, so that I start my review from a complete draft. | Primary Workflow 28-33 |
| R-005 | US-05: As the content operator, I want cover, match-result, standings and closing slides generated in the El Deporte Rey GT visual identity from reusable templates, so that every post looks professional and consistent. | Primary Workflow 35-39; Functional Requirements 59; Branding 67-77 |
| R-006 | US-06: As the content operator, I want an automated visual quality check of every slide before my review, so that wrong scores, standings or team names, overflowing text, inconsistent visuals and wrong dimensions are caught. | Primary Workflow 41-46 |
| R-007 | US-07: As the content operator, I want to preview the carousel and captions, regenerate individual slides and explicitly approve the content, so that nothing I have not approved can be exported. | Primary Workflow 48; Functional Requirements 60-61; Quality Requirements 94 |
| R-008 | US-08: As the content operator, I want to export the approved images and captions, so that I can publish them manually on Instagram. | Primary Workflow 50; Functional Requirements 62; Quality Requirements 95 |
| R-009 | US-09: As the content operator, I want a history of generated content with traceability from each exported slide back to its source data, so that I can revisit past content and show where every fact came from. | Functional Requirements 63; Quality Requirements 93 |
| R-010 | US-10: As the content operator, I want to manage reusable brand assets and carousel templates, and to have brand assets used only when they have actually been provided, so that the brand is applied consistently without placeholder or invented assets. | Functional Requirements 59; Branding 79-82 |

## 5. Functional requirements

| Record ID | Original ID | Type | Statement | Sources (S-000 heading, lines) | Relationships |
|-----------|-------------|------|-----------|--------------------------------|---------------|
| R-020 | - | functional | Web interface for managing content projects: create a project, list existing projects, open a project. | Functional Requirements 54 | refines R-001 |
| R-021 | - | functional | When creating a project the user selects competition, season and matchday; in the MVP the only competition is the UEFA Champions League (seasons and phases: R-417). | Product Vision 12; Primary Workflow 16; Functional Requirements 55; Initial Scope 102 | refines R-001; references R-417 |
| R-022 | - | functional | The Research Agent retrieves, for the selected matchday: match results; teams and scores; match dates; competition standings; relevant competition context. | Primary Workflow 18-23 | refines R-002; depends-on R-021; depends-on ext: sports-data provider (R-400, R-410) |
| R-023 | - | functional | The user starts research from the project and follows its progress: each workflow stage is shown as pending, running, completed or failed; a failed stage reports its reason. | Functional Requirements 56 | refines R-002 |
| R-024 | - | functional | Research results are structured records; each fact carries source attribution (source, reference to its location in the source, retrieval time). | Functional Requirements 57-58; Quality Requirements 87 | refines R-002 |
| R-025 | - | functional | The Fact-Checking Agent independently verifies all factual information against reliable sources and records per fact: verified or not, sources used, reason when not verified. Verification rule: R-411. | Primary Workflow 25-26; Functional Requirements 58 | refines R-003; depends-on R-024; references R-411 |
| R-026 | - | business-rule | If a fact cannot be verified, publication approval is blocked for the content affected by that fact (every slide, headline, slide description or caption that uses it) until it is verified; content that does not use the fact is not blocked. | Quality Requirements 89-90 | refines R-003; depends-on R-025; references R-412 |
| R-027 | - | business-rule | Never invent scores, standings or match statistics: every such value in generated content (slides, headlines, slide descriptions, captions) comes from the verified data; content containing such a value not in the verified data is flagged and cannot be approved. | Quality Requirements 86-90 | refines R-003; depends-on R-025; references R-422 |
| R-028 | - | functional | Verified facts are clearly distinguished from AI-generated commentary; each content element is identified as one or the other (presentation: R-404). | Quality Requirements 88 | refines R-003; references R-404 |
| R-029 | - | functional | The Content Agent prepares, from the verified data: carousel structure, headlines, slide descriptions, social media captions, relevant hashtags. | Primary Workflow 28-33 | refines R-004; depends-on R-025; depends-on ext: AI provider (R-401) |
| R-030 | - | functional | The Graphic Design Agent creates a cover slide, individual match-result slides (one per match), standings slides and a closing slide. | Primary Workflow 35-39 | refines R-005; depends-on R-029, R-031; references R-407 |
| R-031 | - | functional | Slides are produced from reusable branded carousel templates, reused across projects and matchdays. | Functional Requirements 59; Branding 79; Technical Direction 119 | refines R-005, R-010 |
| R-032 | - | functional | Templates apply the brand identity: El Deporte Rey GT, @ElDeporteReyGT, mascot KETSI (images only when provided), colours purple, gold, blue and white. | Branding 67-77 | refines R-005; references R-418 |
| R-033 | - | functional | Reusable brand assets: provided assets (for example logos, mascot images) are registered once and reused by templates across projects. | Branding 79 | refines R-010 |
| R-034 | - | business-rule | Logos, team badges and mascot images are not assumed to exist and are used only when provided; templates produce complete slides without them. | Branding 81-82 | refines R-010; references R-413 |
| R-035 | - | business-rule | Generated visuals preserve the exact verified scores and names; every score and name on a slide equals the verified value exactly (name display convention: R-416). | Quality Requirements 92 | refines R-005; references R-416 |
| R-037 | - | functional | The Visual QA Agent checks every slide: scores and standings match verified data; team names are correct; text fits the layout; visual consistency across the carousel; configured social media dimensions. Results per slide and per check; failure handling: R-420. | Primary Workflow 41-46 | refines R-006; depends-on R-025, R-030; references R-408, R-420 |
| R-038 | - | functional | Before approving, the user previews the carousel (all slides in order) with captions and hashtags. | Primary Workflow 48; Functional Requirements 60 | refines R-007 |
| R-039 | - | business-rule | Explicit user approval is required before any content can be exported for publication; only approved assets can be exported (granularity: R-405; after a change: R-406). | Primary Workflow 50; Functional Requirements 60; Quality Requirements 94 | refines R-007; references R-405, R-406 |
| R-040 | - | functional | The user can regenerate an individual slide without regenerating the other slides. | Functional Requirements 61 | refines R-007; references R-406 |
| R-041 | - | functional | The user exports approved assets for manual publication: slide images and captions with hashtags. | Primary Workflow 50; Functional Requirements 62 | refines R-008; depends-on R-039; references R-421 |
| R-042 | - | constraint | The MVP does not publish automatically to any social platform; publication is manual from the exported files. | Quality Requirements 95; Initial Scope 105 | refines R-008 |
| R-043 | - | functional | History of generated content: past projects with their slides, captions, approval state and exports can be listed and reopened. | Functional Requirements 63 | refines R-009; references R-419 |
| R-044 | - | functional | Traceability from source data to exported slides: for every exported slide, its facts, their verification status and their sources can be retrieved. | Quality Requirements 93; Functional Requirements 57 | refines R-009; depends-on R-024, R-025 |
| R-045 | - | business-rule | Facts are taken only from trustworthy, attributable data sources; which sources qualify is decided by the Product Owner under R-410. | Quality Requirements 87; Primary Workflow 25-26 | refines R-003; references R-410, R-411 |

## 6. Non-functional requirements and constraints

| Record ID | Original ID | Type | Statement | Sources (S-000 heading, lines) | Relationships |
|-----------|-------------|------|-----------|--------------------------------|---------------|
| R-036 | - | non-functional | Numeric information is rendered deterministically: the same verified data and template always produce the same numeric text; numbers are never produced by a non-deterministic generation step. | Quality Requirements 91 | refines R-005; references R-402 |
| R-100 | - | constraint | The MVP is local-first: the platform and its data run on the user's local machine (provider access: R-306). | Initial Scope 99 | references R-306 |
| R-101 | - | constraint | MVP priorities in order: (1) one competition, UEFA Champions League; (2) matchday results and standings; (3) Instagram carousel generation; (4) manual approval and export. | Product Vision 12; Initial Scope 101-105 | - |
| R-102 | - | non-functional | The design supports future extension to more competitions, more social platforms and automated publishing; these are not part of the MVP. | Initial Scope 107-108 | references R-109 |
| R-103 | - | constraint | The technology stack is not prescribed; the Architect proposes it based on these requirements. | Technical Direction 112-113 | - |
| R-104 | - | non-functional | Modular architecture with testable agent boundaries: each workflow stage has defined inputs and outputs and can be tested in isolation. | Technical Direction 116, 118; Primary Workflow 18-46 | references R-302 |
| R-105 | - | non-functional | Strong runtime validation of provider data and of data exchanged between stages; invalid data is rejected and not used. | Technical Direction 117 | - |
| R-106 | - | non-functional | Provider abstraction: AI and sports-data providers are configurable and replaceable by configuration without changing the workflow stages. | Technical Direction 120, 123 | references R-400, R-401 |
| R-107 | - | non-functional | Automated tests cover the workflow stages and the business rules of this document. | Technical Direction 121 | - |
| R-108 | - | non-functional | The platform can be developed, run and tested on a local machine. | Technical Direction 122 | - |
| R-109 | - | constraint | Avoid unnecessary infrastructure and premature complexity: no component that the MVP scope (R-101) does not need. | Technical Direction 125 | references R-101 |

S-000 sets no performance, availability, scale, accessibility or security targets; these are not invented here (see R-307 and section 18).

## 7. Acceptance criteria

Proportional: one or two testable criteria per requirement. There is no existing behaviour, so there are no regression criteria.

| Record ID | Criterion (testable) | Requirement(s) | Sources (S-000) |
|-----------|----------------------|----------------|-----------------|
| R-200 | Given the web interface is open, when the user creates a content project, then it appears in the project list and, when opened, shows its competition, season and matchday. | R-020 | Functional Requirements 54-55 |
| R-201 | The competition selector offers only the UEFA Champions League; the matchday selector lists only matchdays of the selected season; a project cannot be created until all three are selected. | R-021, R-101 | Functional Requirements 55; Initial Scope 101-102 |
| R-202 | With a fixture sports-data provider holding a known matchday, research returns every match with both teams, the score of each finished match and its date, the full standings and at least one competition-context item, all equal to the fixture values. | R-022 | Primary Workflow 18-23 |
| R-203 | While research runs, each stage status is shown; a simulated provider failure shows the stage as failed with a reason, and research can be started again. | R-023 | Functional Requirements 56 |
| R-204 | Every stored fact has a source, a source reference and a retrieval time; a fact without attribution is rejected by validation and not stored. | R-024 | Functional Requirements 57-58; Quality Requirements 87 |
| R-205 | After fact-checking every fact has a verification status; a fact with a seeded disagreement between sources is marked not verified, with a reason naming the sources. | R-025 | Primary Workflow 25-26 |
| R-206 | Given one unverified score, approval of every slide, headline or caption using it is refused with a message naming the fact, while content not using it can still be approved. | R-026 | Quality Requirements 89-90 |
| R-207 | Given a stub AI provider returning a caption (or headline) with a score not in the verified data, that caption (or headline) is flagged and cannot be approved. | R-027 | Quality Requirements 86-90 |
| R-208 | In the review view and in stored content, every text element is identified as verified fact or generated commentary. | R-028 | Quality Requirements 88 |
| R-209 | For a verified matchday, the content draft has an ordered carousel structure with a slide type per slide, a headline and description per slide, a caption and at least one hashtag. | R-029 | Primary Workflow 28-33 |
| R-210 | The carousel has a cover slide, one match-result slide per included match, at least one standings slide and a closing slide. | R-030 | Primary Workflow 35-39 |
| R-211 | Carousels for two matchdays from the same templates share layouts and use only the configured brand palette colours; a template change applies to every carousel generated afterwards. | R-031, R-032 | Functional Requirements 59; Branding 73-79 |
| R-212 | With no logo, team badge or mascot image provided, a complete carousel is generated without errors and without placeholder or substitute images for those assets. | R-034 | Branding 81-82 |
| R-213 | Rendering the same slide twice from the same data and template gives identical numeric text; every score and team name on a slide equals the verified value exactly. | R-035, R-036 | Quality Requirements 91-92 |
| R-214 | For each check (score or standing mismatch, wrong team name, text overflow, inconsistent style, wrong dimensions), a slide seeded with that defect fails that check by name, and a correct slide passes all checks. | R-037 | Primary Workflow 41-46 |
| R-215 | Before approval, the preview shows all slides in carousel order with the caption and hashtags. | R-038 | Primary Workflow 48; Functional Requirements 60 |
| R-216 | Export of content not explicitly approved is refused; after explicit approval export succeeds. | R-039 | Quality Requirements 94 |
| R-217 | Regenerating one slide changes only that slide; the regenerated slide goes through Visual QA again and needs approval again (R-406). | R-040 | Functional Requirements 61; Quality Requirements 94 |
| R-218 | Exporting an approved carousel produces one image per approved slide, in carousel order and at the configured dimensions, and a text file with the approved caption and hashtags. | R-041 | Primary Workflow 50; Functional Requirements 62 |
| R-219 | The MVP has no function that publishes to a social platform, and no export step sends data to one. | R-042 | Quality Requirements 95 |
| R-220 | After an export the project is in the history with its approval state and export time; reopening shows the same slides and captions that were exported. | R-043 | Functional Requirements 63 |
| R-221 | For any exported slide, the platform shows its facts, their verification status and their sources. | R-044 | Quality Requirements 93 |
| R-222 | Following the documented local setup, the full workflow runs on one local machine with external access only to the configured providers. | R-100, R-108 | Initial Scope 99; Technical Direction 122 |
| R-223 | Replacing the configured AI and sports-data providers with stubs needs only a configuration change, and the full workflow then runs end to end. | R-106 | Technical Direction 120-123 |
| R-224 | Provider or inter-stage data violating its expected structure (for example a missing score or malformed date) is rejected with a validation error and used in no content. | R-105 | Technical Direction 117 |
| R-225 | Each workflow stage has automated tests running it in isolation with fixture inputs; the test suite runs without access to real external providers. | R-104, R-107 | Technical Direction 116-121 |
| R-226 | The architecture review confirms that competition, target platform format (dimensions, maximum slides) and publication mode are configuration or data, not logic fixed in the workflow stages. | R-102 | Initial Scope 107-108 |
| R-227 | Every fact names its source, and only sources accepted under R-410 can make a fact verified; a fact supported only by another source stays not verified. | R-045 | Quality Requirements 87 |
| R-228 | A brand asset registered once is available to the templates of every later project without being provided again. | R-033 | Branding 79 |

R-103 (stack proposed by the Architect) and R-109 (no unnecessary infrastructure) are checked in the architecture review rather than by a test.

## 8. Edge cases

| Edge case | Handling | Records |
|-----------|----------|---------|
| Match not finished, postponed or abandoned; matchday still in progress or not started | No result slide without a verified final result; status listed; standings show the "as of" time | R-409, R-026 |
| Sources disagree on a score, date or standings row | Fact not verified; affected content blocked; no manual override | R-025, R-026, R-411, R-412 |
| Provider unavailable, rate-limited, returns no data for the matchday, or returns malformed data | Stage shown as failed with reason; retry; invalid data rejected | R-023, R-203, R-105, R-224 |
| League-phase matchday needs more slides than one Instagram carousel allows | Split into numbered carousels; user may exclude matches | R-407 |
| Long team names, accents or special characters | Text-fit check; exact verified name preserved | R-037, R-035, R-213, R-416 |
| Teams level on points in the standings | Order and values exactly as verified; no recomputed or invented order | R-035, R-411 |
| No brand assets provided | Complete slides without assets or placeholders | R-034, R-212, R-301 |
| Slide regenerated, or research re-run, after approval | Approval lost; QA and approval again | R-406, R-217 |
| AI-generated caption or headline contains a number not in the verified data | Flagged; cannot be approved | R-027, R-207, R-422 |
| Source corrects a value after export | A new research run creates a new version; earlier approvals do not carry over; no correction alerts in the MVP | R-406, R-043 |
| Text fetched from a provider or web page contains instructions aimed at the AI stages | Treated as data; see risk RK-08 and architecture consideration AC-07 | R-105, R-302 |

## 9. Dependencies

External:

| Dependency | Needed by | Records |
|------------|-----------|---------|
| Sports-data provider(s): selection by the Architect, acceptance of terms and cost by the Product Owner | Research, verification | R-022, R-400, R-410, R-411 |
| AI provider(s): selection by the Architect; any paid account by the Product Owner | Content drafting and other AI-based stages | R-029, R-401 |
| Instagram carousel format (dimensions, maximum slides), confirmed at implementation time | Design, Visual QA, export | R-407, R-408, R-303 |
| Brand values and assets from the Product Owner (official colour values, fonts, logo, KETSI images) | Templates | R-301, R-418, R-033 |
| Product Owner decisions | See section 13 | R-410, R-411, R-413, R-414, R-415, R-416 |
| Architecture stage (stack, rendering, storage) | All implementation | R-103, R-402, R-403 |

Internal (record level): R-022 depends on R-021; R-025 depends on R-024; R-026, R-027 and R-029 depend on R-025; R-030 depends on R-029 and R-031; R-037 depends on R-025 and R-030; R-041 depends on R-039; R-044 depends on R-024 and R-025.

Phase order: MVP-P1, then MVP-P2; MVP-P3 can start on fixture data in parallel with MVP-P2 but its acceptance needs verified data from MVP-P2; MVP-P4 needs MVP-P2 and MVP-P3.

Note for the Orchestrator: the project roster has `frontend-developer` disabled ("no user interface detected"), while R-020 requires a web interface. This is a configuration matter for planning, not a requirement change.

## 10. Decisions (with classification and source)

Questions not requiring the Product Owner. Each carries its resolution and basis; ORCHESTRATOR_DECISION items are recommended reversible defaults for the Orchestrator to record.

| Record ID | Question | Classification | Resolution or recommendation | Source / basis |
|-----------|----------|----------------|------------------------------|----------------|
| R-400 | Which sports-data provider(s)? | AUTONOMOUS_DECISION | For the Architect, provider-neutral (R-106), fixture provider for development and tests, bounded by R-410 and R-411. | S-000 lines 112-113, 120, 123 |
| R-401 | Which AI provider(s) and models? | AUTONOMOUS_DECISION | For the Architect, behind the provider abstraction; stub for tests; credentials never in the repository; paid account raised to the PO. | S-000 lines 112-113, 120, 123 |
| R-402 | Slide rendering approach? | AUTONOMOUS_DECISION | For the Architect, bounded by R-035 and R-036: fact-bearing text placed deterministically from verified data. | S-000 lines 91-92, 112-113 |
| R-403 | Data storage? | AUTONOMOUS_DECISION | For the Architect, bounded by R-100, R-109, R-043, R-044. | S-000 lines 99, 112-113, 125 |
| R-404 | Where is "verified fact" vs "commentary" shown? | ORCHESTRATOR_DECISION | Provenance label on every stored element and in the review view; no visible label on exported content; commentary states no unverified numbers. | S-000 line 88; MED-04 |
| R-405 | Approval granularity? | ORCHESTRATOR_DECISION | Per-slide and caption review states plus a final carousel approval that requires all included items approved and none blocked; export needs the final approval. | S-000 lines 48-50, 60, 89-94; MED-04 |
| R-406 | Does approval survive a change? | RESOLVED_BY_EXISTING_SOURCE | No; approval binds to the exact version; changed content needs QA and approval again. | S-000 lines 93-94 |
| R-407 | Matchday exceeds the slides allowed in one carousel? | ORCHESTRATOR_DECISION | Configurable maximum; split into numbered carousels; user can exclude matches; individual match slides kept. | S-000 lines 36, 46, 104; MED-04 |
| R-408 | Slide dimensions? | ORCHESTRATOR_DECISION | Portrait 4:5, 1080 x 1350 px, configurable, confirmed against Instagram's published specifications. | S-000 lines 46, 104; MED-04 |
| R-409 | Unfinished, postponed or abandoned matches; matchday in progress? | ORCHESTRATOR_DECISION | Result slides only for verified final results; others listed with status and left out; standings show "as of" time. | S-000 lines 18-23, 86-90; MED-04 |
| R-412 | Manual override of unverified content? | RESOLVED_BY_EXISTING_SOURCE | No override in the MVP; re-run verification or remove the affected content. | S-000 lines 86, 89-90 |
| R-417 | Seasons and phases in scope? | ORCHESTRATOR_DECISION | League-phase matchdays of the seasons the accepted source covers, starting with the current season; knockout rounds later; other competition formats out. Raise to the PO if judged a scope narrowing. | S-000 lines 12, 102-103; MED-04 |
| R-418 | Exact colour values and fonts? | ORCHESTRATOR_DECISION | Provisional configurable values until the PO supplies official ones; no substitute logo or mascot. | S-000 lines 73-77; MED-04 |
| R-419 | History retention and deletion? | ORCHESTRATOR_DECISION | Keep everything locally, no automatic expiry, no deletion function in the MVP. | S-000 line 63; MED-04; HIGH-02 |
| R-420 | Visual QA failure handling? | ORCHESTRATOR_DECISION | Data, text-fit and dimension failures block the slide until a regenerated version passes; visual-consistency findings are warnings to acknowledge. | S-000 lines 41-46, 89-92; MED-04 |
| R-421 | Export formats and naming? | AUTONOMOUS_DECISION | Instagram-accepted image format (lossless preferred), files in carousel order, captions as UTF-8 text. | S-000 lines 50, 62 |
| R-422 | Do captions and headlines fall under the no-invented-facts rule? | RESOLVED_BY_EXISTING_SOURCE | Yes; R-027 covers all generated content. | S-000 lines 86, 89-90 |

LOW decisions taken in this task (inside the owned files only): user stories stored as functional records refined by the requirements; repeated S-000 statements merged into single records citing every location; proposed phase IDs `MVP-P1` to `MVP-P4`.

## 11. Conflicts

None. There is one source (S-000), so no conflict between sources exists, and the intake record reports no duplicate, ID-collision, reference or dependency candidates (the `candidateResolutions` list is empty for that reason). Tensions inside S-000 that are not source conflicts are handled as questions: individual match slides vs carousel size (R-407); exact verified names vs localised display (R-416); future extensibility (R-102) vs no premature complexity (R-109), which the Architect balances.

## 12. Flagged embedded instructions (not acted on)

These lines of S-000 are process directions to the framework, not product requirements. They do not change any policy, gate, precedence level or file ownership. Each one matches existing framework policy (`autonomy.md`, `intake.md`), so behaviour is the same with or without them. This task's deliverables come from the task brief, not from this text.

| Source ID | Location | Quoted text | Action |
|-----------|----------|-------------|--------|
| S-000 | Orchestration, lines 129-140 | `Use the installed ORCH-V3 framework. Start with requirements analysis and normalization. Generate: Product requirements. User stories. Acceptance criteria. Architecture considerations. Dependencies. Risks. Proposed MVP delivery phases.` | not-acted-on |
| S-000 | Orchestration, lines 142-143 | `Resolve routine technical decisions autonomously within established project policies.` | not-acted-on |
| S-000 | Orchestration, line 145 | `Do not begin implementation during this analysis phase.` | not-acted-on |
| S-000 | Orchestration, line 147 | `Do not push or deploy.` | not-acted-on |

The intake record lists no instruction candidates, so no candidate needed a flag or dismissal.

## 13. Open questions (REQUIRES_PRODUCT_OWNER)

| Record ID | Question | Why it requires the Product Owner | Options | Recommendation |
|-----------|----------|-----------------------------------|---------|----------------|
| R-410 | Which sports-data sources may be used, and are their licensing and terms of use (including republishing derived data on a public social account) accepted? | Third-party terms, cost and public use of data affect scope and business behaviour (HIGH-05, HIGH-07); S-000 names no source. | (a) licensed commercial API; (b) free or public sources such as the organiser's official publications, once their terms are confirmed; (c) licensed API as primary and an official public source for independent verification | (c). The Architect prepares a shortlist with coverage, a terms summary and cost; development continues on fixtures. No legal assessment is given here. |
| R-411 | When is a fact "verified"? | Decides which content is blocked: a business-rule semantics no source decides (HIGH-07). | (a) two independent accepted sources agree exactly; otherwise not verified; (b) the organiser's official publication alone suffices; (c) research source plus one independent source, with the official publication deciding disagreements | (a) for scores, dates and standings; recomputing standings from verified results as an extra check is a consideration for the Architect. |
| R-413 | May slides use club badges and competition names or marks, and in what form? | Use of third-party marks on public content affects scope and business behaviour (HIGH-05, HIGH-07). | (a) names as plain text, own brand assets only; (b) badges and marks when the PO provides them and confirms the right to use them; (c) (a) now, with an optional, empty badge slot | (c). No legal assessment of trademark use is given here. |
| R-414 | Does the MVP process personal data (for example goal scorers' names, user accounts)? | Personal data handling (HIGH-04) and scope (HIGH-07); `riskProfile.personalData` is "unknown". | (a) team- and competition-level data only; (b) also public player data such as goal scorers; (c) (b) plus player statistics | (a), so the configuration can record no personal data; (b) later by PO decision. |
| R-415 | What is the user and authentication model? | Identity and authentication model is security-sensitive (HIGH-03). | (a) single local operator without login, interface reachable from the local machine only; (b) local login for one or more operators; (c) multi-user accounts with roles (needs hosting) | (a); revisit when hosting or several operators are planned. |
| R-416 | Which language is content generated in, and how are team names displayed? | The name-correctness rule (S-000 lines 43, 92) depends on the display convention; content language is a product decision (HIGH-07). | Language: (a) Spanish, (b) English, (c) configurable per project. Names: (i) exactly as verified; (ii) PO-approved display names bound to the verified team identity | Language (c) with Spanish as default; names (i) for the MVP. |

## 14. Assumptions (each with its basis)

| Record ID | Assumption | Basis |
|-----------|------------|-------|
| R-300 | One user role, the content operator; followers are the audience, not users. | S-000 refers only to "the user" (lines 16, 48); auth model open (R-415). |
| R-301 | No logos, mascot images, badges or brand fonts have been provided yet. | S-000 lines 81-82; the inventory holds only the S-000 text. |
| R-302 | The five "agents" are functional product stages; whether each uses AI, deterministic code or both is an architecture decision. They are product features, not framework roles. | S-000 lines 18-46 describe responsibilities; lines 112-113 leave the stack to the Architect. |
| R-303 | Instagram is the only MVP platform; "social media dimensions" means the Instagram carousel format. | S-000 lines 104, 107-108. |
| R-304 | Export means local files (images and caption text) uploaded manually by the user. | S-000 lines 50, 62, 95, 99. |
| R-305 | "Relevant competition context" means short factual matchday context derived from competition data, and it is fact-checked. | S-000 line 23 is undefined; lines 25-26 require verifying all facts. |
| R-306 | Local-first is not offline: internet access is needed at run time for the providers. | S-000 lines 18-26, 87, 99, 123. |
| R-307 | No performance, availability or scale targets for the MVP; the load is that of one operator. | S-000 states none; lines 99, 125. |
| R-308 | Research collects only the items in S-000 lines 19-23; no detailed match statistics or player-level data unless the PO decides otherwise (R-414). | S-000 lines 18-23, 86. |

## 15. Proposed work items (MVP delivery phases)

The phases follow the "Initial Scope" priorities of S-000 (lines 101-105). They are proposals for the Orchestrator's planning, not approved work items.

| Work-item ID | Title | Records |
|--------------|-------|---------|
| MVP-P1 | Phase 1: Foundation: local web interface, content projects and UEFA Champions League selection, provider abstraction with fixture and stub providers, runtime validation, automated test harness (priority 1) | R-001, R-020, R-021, R-100, R-101, R-102, R-103, R-104, R-105, R-106, R-107, R-108, R-109, R-200, R-201, R-222, R-223, R-224, R-225, R-226, R-300, R-306, R-307, R-400, R-401, R-403, R-415, R-417 |
| MVP-P2 | Phase 2: Verified matchday results and standings: research, source attribution, independent fact-checking (priority 2) | R-002, R-003, R-022, R-023, R-024, R-025, R-045, R-202, R-203, R-204, R-205, R-227, R-305, R-308, R-409, R-410, R-411, R-412, R-414 |
| MVP-P3 | Phase 3: Instagram carousel generation: content drafting, branded templates and assets, deterministic slide rendering, visual QA (priority 3) | R-004, R-005, R-006, R-010, R-027, R-028, R-029, R-030, R-031, R-032, R-033, R-034, R-035, R-036, R-037, R-207, R-208, R-209, R-210, R-211, R-212, R-213, R-214, R-228, R-301, R-302, R-303, R-402, R-404, R-407, R-408, R-413, R-416, R-418, R-420, R-422 |
| MVP-P4 | Phase 4: Review, manual approval and export, history and traceability (priority 4) | R-007, R-008, R-009, R-026, R-038, R-039, R-040, R-041, R-042, R-043, R-044, R-206, R-215, R-216, R-217, R-218, R-219, R-220, R-221, R-304, R-405, R-406, R-419, R-421 |

Blocking PO questions by phase: MVP-P1 needs R-415 before the web interface is exposed; MVP-P2 needs R-410, R-411 and R-414 before work with real providers (fixture-based work can start); MVP-P3 needs R-413 and R-416 before final templates and copy.

## 16. Out of scope (MVP)

- Automatic publishing to any social platform (R-042); other social platforms and other competitions (R-102, R-101).
- Knockout rounds and other competition formats (R-417, default).
- Detailed match statistics and player-level data (R-308; pending R-414).
- Hosted or multi-user operation (R-100; pending R-415).
- Manual override of unverified facts (R-412); deletion of history (R-419).
- Alerts when a source corrects data after export.

## 17. Risks

| ID | Risk | Mitigation / owner | Records |
|----|------|--------------------|---------|
| RK-01 | Data-source terms may not permit republishing derived content, or may cost more than expected. | PO decision before real-provider integration; fixture data until then. | R-410 |
| RK-02 | A strict verification rule may block content often (one source unavailable or slow to update). | Clear reasons per fact; re-run verification; PO chooses the rule. | R-411, R-026, R-412 |
| RK-03 | AI-generated text may state invented numbers or claims. | Check all generated text against verified data; stub-based tests. | R-027, R-207, R-422 |
| RK-04 | Generative imagery may distort scores or names. | Deterministic rendering of all fact-bearing text. | R-035, R-036, R-402 |
| RK-05 | Use of club badges or competition marks on public content. | No marks in the MVP unless the PO decides otherwise. | R-413, R-034 |
| RK-06 | Instagram format or limits change. | Dimensions and slide limit held as configuration. | R-407, R-408 |
| RK-07 | AI or data provider cost, rate limits and outages. | Provider abstraction, retries shown in the interface, cost raised to the PO with the architecture. | R-106, R-401, R-023 |
| RK-08 | Text from providers or web pages may contain instructions aimed at the AI stages (prompt injection), which could alter content. | Treat all fetched content as data; validation; security review of the architecture. | R-105, R-302 |
| RK-09 | Content produced before all matches of a matchday are final. | Result slides only for verified final results; "as of" standings. | R-409 |
| RK-10 | Pressure toward extensibility adds premature complexity. | Extension points as configuration only; review against R-109. | R-102, R-109, R-226 |
| RK-11 | The roster has no front-end role enabled although a web interface is required. | Orchestrator to review the roster at planning. | R-020 |
| RK-12 | Provider credentials (API keys) could leak into the repository. | Credentials kept out of the repository; security review. | R-401 |

## 18. Architecture considerations (for the Architect)

These are considerations, not decisions. The stack is proposed by the Architect (R-103).

- AC-01 Workflow stages as separate modules with typed, runtime-validated inputs and outputs (R-104, R-105), so that each can run against fixtures (R-225).
- AC-02 A verified-fact model separate from generated content, with provenance on every content element (R-024, R-028, R-044, R-404).
- AC-03 Deterministic, template-based placement of every fact-bearing value; any generative imagery limited to decoration (R-035, R-036, R-402).
- AC-04 Some "agents" may be better as deterministic code, for example Visual QA data checks and standings recomputation (R-302, R-411).
- AC-05 Provider adapters with fixture and stub implementations, selected by configuration (R-106, R-223).
- AC-06 Versioned content so that approval binds to an exact version and history and traceability are preserved (R-406, R-043, R-044).
- AC-07 Treat provider and web content as untrusted input to the AI stages; keep instructions and data apart (RK-08).
- AC-08 Credentials supplied through local configuration that is never committed (R-401).
- AC-09 Local-first storage without separately hosted infrastructure (R-100, R-109, R-403).
- AC-10 Competition, platform format and publication mode as configuration points, for future extension without redesign (R-102, R-226).
- AC-11 Security-relevant decisions (local-only binding of the interface, auth model) follow the PO answer to R-415.
