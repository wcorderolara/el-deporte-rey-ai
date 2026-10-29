# WI-2.1 — Product and UX/UI Redesign Proposal

Status: Refined by confirmed Product Owner decisions; implementation approval pending
Date: 2026-10-29
Audience: Product Owner, design, frontend, QA
Implementation constraint: analysis only; no application code or API contract changes

## 1. Product vision and executive assessment

El Deporte Rey AI has a strong functional and accessibility foundation, but its interface exposes the architecture more prominently than the creator’s workflow. The product currently feels like a trustworthy operator console: precise, explicit, and auditable, but dense, visually generic, and fragmented across projects, executions, facts, review, and export screens.

The approved product direction is an **AI-assisted static sports content creation studio**. It transforms sports information into professional static graphics and written copy that a non-technical El Deporte Rey creator can customize, approve, and download. It is not a social-media management/publishing product and not a video-generation/editing product.

The governing principle is: **from sports information to downloadable creative assets in the fewest reasonable steps**.

The redesign should not simplify the safety model. It should simplify how the user encounters it. The product model is a **guided creative workspace** with five understandable stages:

1. Definir contenido.
2. Confirmar datos.
3. Generar contenido.
4. Personalizar y revisar.
5. Descargar.

The detailed facts, evidence, import versions, QA results, and trace records remain available as progressive disclosure and specialist views. This preserves WI-1 while making the main path understandable without knowledge of runs, providers, schemas, or workflow stages.

### Product scope guardrails

In scope are automatic/manual/demo sports data, AI-assisted headlines/summaries/captions/hashtags, professional static graphics, carousels, individual posts, Stories, static Reel/TikTok covers, brand templates, customization, approval, download, and local history.

Intentionally out of scope are social credentials/connections, publication, uploading, scheduling, social account/message/comment/analytics management, finished video, video editing, animation, audio, and timelines. A Reel/TikTok cover is always a static 1080 × 1920 image, never a video.

The current product implements the 4:5 carousel baseline. Other formats are approved product scope but require separate later architecture and contract work; they are not part of the initial visual redesign.

## 2. Problem ranking

Severity definitions:

- **Critical:** prevents or seriously endangers successful completion.
- **High:** causes frequent confusion, delay, or error in the primary journey.
- **Medium:** reduces efficiency, clarity, polish, or consistency.
- **Low:** refinement opportunity with limited effect on task completion.

| Rank | Severity | Problem | Evidence and impact | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | High | The product is organized around system objects rather than the creator’s goal. | Users create a project, then separately start an “execution,” inspect “facts,” approve “elements,” give “final approval,” and then visit exports. | Introduce a project workspace with a persistent five-stage progress model and a single recommended next action. |
| 2 | High | The review experience is a long, dense document. | Every slide, image, text segment, provenance badge, blocking fact, flag, QA result, action, caption, final approval, exclusions editor, and left-out match appears in one column. | Use a slide rail + large preview + inspector layout on desktop; provide issue filtering and “approve and next.” Keep all current controls. |
| 3 | High | Creation asks for technical decisions too early. | Source availability, listing provenance, stage diagnostics, and standings behavior are prominent before the user can create. | Default the recommended available source and current season; present a concise selection summary; move diagnostics into “Data details.” |
| 4 | High | Project context and progress are lost between screens. | Facts, review, and exports rely on backlinks and have no persistent project navigation or step state. | Add breadcrumb/project header, step navigation, project status, and next-action affordance on every project route. |
| 5 | High | Responsive behavior is incidental rather than designed. | There are no width breakpoints; wide tables mostly rely on horizontal scrolling; the project list has eight columns; touch targets can be as small as a 0.25rem-padded text button. | Define mobile/tablet/desktop layout behavior, transform key tables into cards on narrow screens, and standardize 44×44 CSS-pixel interactive targets. |
| 6 | Medium | Visual identity is disconnected from the configured brand. | The UI uses a generic system font and blue accent, while `config/brand.json` defines provisional purple/gold/blue and Montserrat/Inter roles already bundled for rendering. | Align application chrome to the approved brand direction after Product Owner confirmation; use the same typographic voice without coupling UI behavior to renderer config. |
| 7 | Medium | Visual hierarchy is flat and borders are overused. | Most content is white/gray with one-pixel borders, default heading sizes, compact spacing, and similarly weighted sections. | Establish page, section, card, metadata, and action hierarchy; use surface elevation and whitespace selectively. |
| 8 | Medium | Repeated UI patterns are implemented separately. | Buttons, tables, cards, definition lists, notices, form controls, and visually-hidden utilities recur across feature CSS modules. | Build shared primitives and tokens incrementally; retain feature components for domain behavior. |
| 9 | Medium | Manual import combines too many jobs. | Input channel, large form, result, history, and version browser share one route and page. | Split the experience into tabs or subviews: Import data, Import history, Data versions. Preserve current routes as compatible entry points. |
| 10 | Medium | Feedback is accessible but visually weak. | Loading and success often appear as plain paragraphs with reserved blank space; run progress is a diagnostic table; readiness is distributed. | Add consistent inline status, toast/announcement, empty state, progress stepper, and completion summary components. |
| 11 | Medium | Technical identifiers are overexposed. | Fact keys, version IDs, carousel/final-approval IDs, hashes, source IDs, and directories appear prominently in several views. | Keep them in expandable audit metadata or copyable detail panels, not as the first reading layer. |
| 12 | Low | Navigation labels are accurate but long and configuration-heavy. | “Importaciones manuales” and “Marca y plantillas” are peers of the main creation area. | Make Crear contenido the global primary action; keep Proyectos and the core Datos capability directly reachable; keep brand/templates secondary. |

No Critical issue was identified: the existing flows are technically completable, tested, and guarded. The redesign priority is comprehension and efficiency, not recovery of broken functionality.

## 3. Proposed information architecture

### Primary navigation

```text
El Deporte Rey AI
├── Crear contenido [primary action]
├── Proyectos
│   ├── Todos los proyectos
│   └── Proyecto
│       ├── 1. Definir contenido
│       ├── 2. Confirmar datos
│       ├── 3. Generar contenido
│       ├── 4. Personalizar y revisar
│       └── 5. Descargar
├── Datos
│   ├── Importar datos
│   ├── Historial de importaciones
│   └── Versiones
└── Marca y plantillas
    ├── Recursos de marca
    └── Plantillas
```

“Facts and verification” becomes a detailed view inside **Confirmar datos**. Run-stage diagnostics become expandable process details inside **Generar contenido**. Export detail and trace remain deep, immutable records linked from **Descargar**. Datos remains directly reachable because manual import is a core capability, not merely a setting.

### Route strategy

Do not break existing bookmarks or testable paths. The first implementation can preserve all current routes and render them inside a shared project-workspace shell. Optional friendlier aliases can be considered later, but are not necessary for the redesign.

### Global versus project-local concepts

| Global | Project-local |
| --- | --- |
| Project list | Competition/season/stage/matchday selection |
| Manual import history and versions | Selected data source and data readiness |
| Brand assets and template catalogue | Runs/redrafts and generated draft |
| Application status/local-only notice | Facts, review, approval, export history, trace |

## 4. Proposed user journey

### Recommended default journey

```text
Projects dashboard
  -> Crear contenido
     1. Definir contenido
        format + competition + period + language
        only implemented formats are enabled
     2. Confirmar datos
        automatic, manual, or demo choice
        readable sports-data preview and readiness summary
     3. Generar contenido
        confirm data and start one guided create/generate action
        understandable progress and recoverable failures
        completion previews + Revisar contenido (no auto-redirect)
     4. Personalizar y revisar
        format-aware visual editor
        Aprobar y siguiente per asset; explicit final approval
     5. Descargar
        Descargar contenido
        images, text, manifest, local history and trace
```

This confirms the five-stage hypothesis. Automatic retrieval is the recommended default when available, manual import is both an in-flow alternative and a dedicated Datos capability, and demonstration data provides a safe trial path.

### Decision and click reduction

- Preselect the first recommended available source, as today, but hide the source chooser behind “Change source” unless multiple meaningful choices exist.
- Preselect the current season when the catalogue identifies one; keep the ability to change it.
- Recommend the most relevant selectable stage/matchday, but require a visible confirmation before content generation.
- Offer one “Confirmar datos y generar” action while sequencing the existing create-project and start-run calls in the client. If project creation succeeds and generation fails, land in the project workspace with a clear retry action.
- After generation, remain on a clear completion state with previews and **Revisar contenido**; do not redirect automatically.
- In Review, add **Aprobar y siguiente** and an issue-only filter. Do not add bulk approval in the initial redesign.
- Place **Descargar contenido** in the valid-final-approval completion state and the download screen. Both use the existing export contract internally.
- After a successful manual import, offer **Crear contenido con estos datos**, carrying competition/season context without changing the API payload.

## 5. Screen-by-screen redesign recommendations

### Application shell

- Replace the plain horizontal header with a recognizable brand header: official logo area when supplied, compact Proyectos/Datos/Marca navigation, and a prominent **Crear contenido** action.
- Keep the skip link, semantic landmarks, current-page treatment, route focus management, local-only notice, and no-login behavior.
- Add breadcrumb/context on deep routes and a compact mobile navigation pattern.
- Treat “local, single operator, no automatic publication” as a persistent trust indicator, not a visually dominant footer message.
- Use a text wordmark or neutral reserved asset slot until official branding is supplied; do not invent a logo or KETSI artwork.

### Projects dashboard

- Make **Crear contenido** the primary action; use Proyecto only for the saved workspace/record.
- Replace the eight-column table as the only view with responsive project cards or a hybrid list. Each item should show: title/competition, period, workflow status, last activity/export, and one “Continue” action.
- Show the static content format and move data mode, demonstration status, and language into compact badges/metadata.
- Group or filter by status: Needs attention, In progress, Ready to export, Exported.
- Preserve complete metadata in a detail disclosure and preserve chronological history.
- Add useful empty state guidance that leads directly to creation.

### Crear contenido / project definition

- Begin with a static-format choice, then use a contained step form with Content, Sports selection, Data, and Language groups.
- Enable only formats actually implemented. The initial visual redesign keeps Carrusel as the available format; later format work items activate Publicación, Historia, and Portada para Reel.
- Show competition choices as searchable/selectable cards or a combobox when catalogue size grows; retain availability explanations for disabled choices.
- Display the selected source as a compact recommendation with an explicit “Change” action.
- Keep season, stage, matchday, and whole-stage semantics exactly as supplied by the API.
- Summarize standings availability as an outcome (“This carousel will not include standings”) rather than a source diagnostic.
- Put catalogue retrieval time, cache state, source IDs, and detailed availability in “Data details.”
- Use a persistent selection summary before submission.

### Project workspace / generation

- Replace the metadata-first project detail with a workspace header containing title, competition/period, mode, language, overall status, and the next recommended action.
- Show the five workflow stages as a user-facing stepper. Map existing workflow stages to a concise generation progress component; preserve the full stage table inside “Technical details.”
- Rename creator-facing actions: “Generar contenido” for a full run and “Generar nueva versión” for redraft. Keep precise explanatory text and failure recovery.
- Keep language change close to content generation; explain that a new version is required after changing it.
- Show facts/review/export as workspace stages rather than unrelated inline links.
- On completion, show asset previews and **Revisar contenido** without automatic navigation.

### Data and verification

- Start with a summary: data readiness, number verified/unverified/attested, publication impact, source freshness, and affected slides.
- Default to grouped match cards or a compact summary table. Put evidence and dispute records in expandable detail panels.
- Keep manual approval and revocation explicit. Place the policy explanation once at page level, then show concise per-fact state.
- Replace repeated long explanations with reusable tooltips/help panels whose visible labels remain unambiguous.
- Add filters for Needs attention, Unverified, Manually approved, Verified, and Used in carousel.
- Preserve all fact keys, source references, import-version links, disputes, and left-out matches.

### Review and approval

- Desktop: three regions—asset/slide rail, large aspect-ratio preview, and review inspector. Tablet: preview above inspector with horizontal rail. Mobile: one asset at a time with sticky previous/next and action bar.
- Adapt the editor to format capability. Carousels retain ordering and per-slide state; future single-image formats omit unnecessary carousel controls.
- Show per-slide state on thumbnails: clean, warning, blocked, approved, superseded.
- Put text, provenance, QA, blocking facts, and version history into inspector tabs/accordions so the preview remains central.
- Add filters: All, Needs attention, Not approved, Approved.
- Provide **Aprobar y siguiente**; keep Withdraw and Regenerate available but visually secondary. Do not add bulk approval yet.
- Keep QA acknowledgements explicit and never auto-acknowledge warnings.
- Keep exclusions as a project-level content option, but present it before or beside generation when possible; clearly explain that saving exclusions creates a new draft.
- Show final approval as a clear completion gate with a checklist of remaining obstacles.
- On final approval, offer **Descargar contenido** immediately.

#### Editor capability boundary

The target right inspector includes headline/supporting-text editing, compatible template selection, brand settings, regeneration, and approval. WI-1 currently supports review, regeneration, global active brand assets, and template previews, but not direct saved text edits, per-asset template selection, or per-project brand-style selection through the public API.

Do not render functional-looking edit controls that cannot persist. Introduce the editor in two capability layers:

1. **Review workspace layer:** preview, provenance, issues, regeneration, approval, withdrawal, final approval, and existing brand/template information using current contracts.
2. **Editing layer:** after a separately approved additive contract/data design, allow constrained text and style changes that create a new immutable element version, re-render, re-run QA, retain provenance/fact bindings, and invalidate affected approvals.

“Edit graphics” should initially mean safe template/style selection, authorized brand asset application, and supported text fields—not an unrestricted vector/canvas editor. Any direct-edit contract must include optimistic version checks, validation, audit history, deterministic rendering, and the existing approval rules.

### Download and history

- Lead with download readiness and one primary **Descargar contenido** action.
- After export generation, show a download success panel with package contents, destination, and “Ver archivos y detalles.”
- Present history as a readable list with date, data mode, carousel, and status. Move directory paths and IDs into details.
- Preserve file hashes, manifest/file listing, exact exported versions, no-delete policy, and no-automatic-publication notice.
- Keep slide trace as an explicit “Why is this on the slide?” audit link.
- Never introduce Publish, Publish to Instagram, Schedule, account connection, or social upload language/actions.

### Manual data and imports

- Keep Datos directly accessible and divide it into Import, History, and Versions tabs/subroutes while preserving the existing underlying components and routes.
- Make File the recommended path. Explain JSON/CSV layout in a downloadable/example-oriented advanced section.
- Treat the large manual form as an advanced fallback and group it into clear substeps: Competition, Teams, Matches, Standings, Source.
- Hide generated/internal keys unless needed for error resolution.
- Keep the all-or-nothing validation model, complete error table, original download, hashes, version history, and safety wording.
- Add a contextual continuation from an applied import to a prefilled **Crear contenido** flow.

### Brand and templates

- Separate Brand assets and Templates into tabs or clearly distinct subpages.
- Show active assets first, with a strong active/inactive state and preview.
- Present the configured palette and type direction so the product’s visual identity is understandable.
- Preserve the authorization constraints, allowed asset kinds, activation behavior, template versions, language previews, and empty badge slots.
- Use the approved provisional palette/type direction, while clearly labelling asset placeholders as provisional until official logo, guidelines, templates, and KETSI assets are supplied.
- Do not invent replacement logos or redesign KETSI.

### Import/export/trace detail screens

- Use a consistent immutable-record layout: breadcrumb, record title, summary metadata, primary content, and expandable technical metadata.
- Keep identifiers copyable but visually secondary.
- On narrow screens, render summary lists and data cards before full tables; retain a table view for comparison-heavy data.

## 6. Component and design-system direction

### Brand direction

The repository already contains a provisional direction:

- Primary purple `#5B2A86`
- Dark purple `#2E1145`
- Gold accent `#D4AF37`
- Secondary blue `#1F4FB8`
- Montserrat ExtraBold for display headings
- Inter for body and numeric content

PD-UI-02 approves this provisional visual direction for the redesign. It remains replaceable when official brand guidelines arrive. Gold should be an accent rather than body text on white. Purple should anchor navigation and primary actions. Electric blue should support active/interactive emphasis. White and dark neutral surfaces provide contrast and creative-studio depth. Verification, warning, error, demo, and attested states must retain independent semantic colors and labels.

PD-UI-14 selects a hybrid Google Stitch direction: use Option A for the premium dark, energetic sports identity and Option B for task clarity, readable hierarchy, familiar controls, and intuitive progression. Dark styling must never reduce legibility or make every surface visually equal.

### Token layers

PD-UI-16 through PD-UI-18 approve Tailwind CSS v4 with Design Tokens for UI-01. Tokens remain framework-portable through CSS custom properties and are mapped into Tailwind utilities; Tailwind class choices must not become a competing token system:

- Color: brand, canvas, surface, border, text, muted, focus, success, warning, error, info, attested, demo.
- Typography: display, body, numeric/metadata; size and line-height scale.
- Spacing: a consistent 4px-based scale.
- Shape: 6/10/16px radii for controls/cards/panels.
- Elevation: minimal card/overlay levels.
- Layout: content widths, sidebar widths, header heights, breakpoints.
- Motion: short feedback transitions, with the existing reduced-motion override.

### Shared primitives

Recommended first primitives, implemented in the existing React application with Tailwind v4 and token-backed variants:

- `Button` and `ButtonLink`: primary, secondary, quiet, danger; loading and disabled states.
- `IconButton` with accessible name and 44×44 target.
- `PageHeader`, `SectionHeader`, `Breadcrumbs`, `ProjectProgress`.
- `Card`, `Panel`, `Disclosure`, `Tabs`, `EmptyState`.
- `Field`, `SelectField`, `RadioCardGroup`, `FileField`, `ErrorSummary`.
- `StatusBadge`, `DataModeBadge`, and a unified semantic `Alert/Notice` family building on existing shared UI.
- `DataTable` with caption, responsive wrapper, density, sticky header where useful, and card alternative.
- `AsyncBoundary`/`LoadingState`/`ErrorState` to standardize request feedback without introducing a state library.
- `SlideThumbnail`, `SlideRail`, `SlidePreview`, `ReviewInspector`, `StickyActionBar`.

Do not build a general-purpose component library before using the components. Extract each primitive as the first redesigned screen needs it, then reuse it in the next screen.

Tailwind and existing CSS Modules coexist during migration. New/redesigned primitives target Tailwind; untouched feature components keep their modules. Do not bulk-translate or delete modules. `tailwind-v4-migration-strategy.md` defines ownership boundaries, rollout order, verification, and rollback.

### Duplication to consolidate

- Primary and secondary button CSS appears in Projects, Review, Imports, Brand, Facts, and History.
- Table wrapper/table/caption/cell rules appear in all six features and shared error UI.
- Definition-list layouts appear in Projects, Review, Imports, Brand, Facts, and History.
- Notice, warning, blocked, success, and attested panels use related but separate styles.
- `visuallyHidden` is repeated in multiple feature modules.
- Form labels, hints, inputs, errors, fieldsets, and option groups are duplicated between Imports and Brand and partially in Projects/Review.
- Feature request hooks repeat loading/error/reload concepts; a small shared state vocabulary is warranted, but domain-specific API calls should remain in features.

## 7. Responsive behavior

Define and test behavior, not just breakpoints:

| Range | Recommended behavior |
| --- | --- |
| 320–599px | Single column; compact header/menu; 16px page gutter; project cards; focused asset preview/review; approval and download; advanced editing may direct to tablet/desktop; technical tables use labelled scroll regions or card rows. |
| 600–899px | Two-column forms where safe; horizontal slide rail; preview above inspector; project metadata in a two-column grid. |
| 900–1199px | Persistent project step navigation; review preview + inspector; slide rail remains horizontal or narrow vertical. |
| 1200px+ | Full three-region review workspace; wider dashboard; constrained reading widths for copy-heavy content. |

Additional requirements:

- No primary action should depend on horizontal scrolling.
- Preserve zoom up to 200% without loss of content or action access.
- Use `min-width: 0` and robust text wrapping for generated content, names, IDs, and paths.
- Do not convert comparison-heavy tables to ambiguous cards unless every row keeps its labels.
- Make mobile order follow task priority: status, content, issue, action, metadata.
- Do not require full manual form entry, template composition, or advanced graphic editing on small phones in the initial redesign.
- Test long Spanish strings, English generated content, 20-slide carousels, empty states, and maximum validation errors.

## 8. Accessibility recommendations

The current semantic baseline is notably strong. Preserve it and extend it:

- Maintain the skip link, landmarks, logical headings, labelled navigation, route focus movement, fieldset/legend use, linked errors, live regions, and reduced-motion behavior.
- Target WCAG 2.2 AA, including focus appearance, target size, reflow, text spacing, and status-message behavior—not only axe serious/critical checks.
- Keep all status meanings available in text and symbol; do not rely on thumbnail color.
- Ensure stepper and tabs use correct semantics and keyboard behavior.
- When Review becomes spatial, keep DOM and focus order aligned with the visual task order.
- On slide change, announce slide number/title without moving focus unexpectedly.
- Provide meaningful image alternatives for generated slides; allow opening a larger preview without trapping keyboard or screen-reader users.
- Make every scrollable table region focusable and labelled consistently.
- Avoid tooltip-only explanations; critical information must be visible or reachable by keyboard/touch.
- Maintain explicit confirmation for manual fact approval, QA acknowledgement, and final approval. Bulk approval is out of scope for the initial redesign.
- Extend tests to mobile viewport/reflow, keyboard-only completion, 200% zoom, forced colors, and reduced motion.

## 9. Functionality that must be preserved

The redesign must retain all of the following, even when moved behind progressive disclosure:

1. Catalogue-driven competition/source/season/stage/matchday selection and source-specific availability.
2. DEMO_DATA, MANUAL_DATA, and LIVE_DATA distinctions and descriptions.
3. Current/manual whole-stage and matchday semantics and standings availability behavior.
4. Full runs, redrafts, polling, stage progress, failure details, and restart.
5. Facts, statuses, evidence, independent-source roles, references, disputes, reasons, and left-out matches.
6. Manual fact approval/revocation, carried-over approval, and operator-attested wording.
7. Generated carousel ordering, slide/caption text, provenance, content flags, QA results, QA acknowledgement, regeneration, approval withdrawal, and version state.
8. Match exclusions and the resulting draft regeneration behavior.
9. Explicit element approval and separate final approval, including invalidation when dependencies change.
10. Export eligibility, file generation, directory/file/hash/manifest information, history, immutable reopen, and slide trace.
11. JSON/CSV/form imports, whole-document validation, all errors, original downloads, declared source, selection versions, and current/superseded states.
12. Brand asset registration and activation, allowed asset types, template versions, preview language, and authorization restrictions.
13. Spanish-first UI, optional Spanish/English generated content, demonstration warnings, and no false real-time claims.
14. Local single-operator/no-login operation, same-origin protections, no automatic publication, no export deletion, and no unauthorized external assets.
15. Existing API contracts, backend business rules, typed validation, and security constraints.

## 10. Recommended implementation phases

The approved incremental sequence is detailed in `incremental-ux-ui-implementation-plan.md`:

1. **UI-01:** Design tokens, shared components, and application shell.
2. **UI-02:** Dashboard and **Crear contenido** entry point.
3. **UI-03:** Competition selection and data confirmation, including contextual manual import.
4. **UI-04:** Visual carousel editor, **Aprobar y siguiente**, and final approval.
5. **UI-05:** **Descargar contenido**, history, manual-data management, and brand/template organization.
6. **UI-06:** Responsive, accessibility, usability-metric, and regression hardening.

Before UI-01, evaluate the selected Google Stitch design and validate the five-stage low-fidelity flow. New static formats follow the separate SF-00 through SF-05 roadmap only after the carousel redesign is stable; they are not combined with UI-01 through UI-06.

UI-01 specifically includes Tailwind CSS v4 integration in the current Vite SPA, token definition/mapping, baseline/reset review, shared primitives, the shell, and controlled CSS Modules coexistence. It does not include a full CSS rewrite or Next.js migration.

## 11. Risks and dependencies

| Risk/dependency | Impact | Mitigation |
| --- | --- | --- |
| Brand assets/guidelines are still provisional even though the direction is approved | Final asset placement could change | Use replaceable asset slots and provisional tokens; keep semantic tokens independent of brand tokens; never invent a logo/KETSI. |
| No creator research has yet validated the workflow | A polished redesign could optimize the wrong assumptions | Validate the five-stage journey and terminology before high-fidelity implementation. |
| Existing tests rely on visible copy, roles, and route structure | Broad UI changes may create large test churn | Preserve semantics/routes; update tests by phase and retain behavior assertions. |
| Client-side create-and-generate sequencing can partially succeed | User may get a project without a run | Define recovery state and idempotent UI behavior; do not hide the created project. |
| Sequential approval remains interaction-heavy for long carousels | Review time may remain high | Implement Aprobar y siguiente, keyboard efficiency, issue filters, and persistent progress; bulk approval is intentionally out of scope. |
| Progressive disclosure could hide safety-critical information | Trust and compliance may degrade | Keep publication blockers, demo state, attested state, QA warnings, and final approval visible at decision points. |
| Dense audit data is difficult on mobile | Horizontal scroll and comprehension problems | Design summary cards plus labelled detail tables; test with maximum real fixture sizes. |
| UI font use may require web-specific loading work | Layout shift or inconsistent typography | Reuse bundled licensed fonts through local assets only; define fallbacks and preload deliberately, without new packages. |
| Current UI has no screenshot baseline | Visual regressions may be missed | Add targeted Playwright screenshots only after the design foundation stabilizes. |
| Current local-only, no-login architecture differs from a future commercial SaaS | Premature account/team patterns would misrepresent current capabilities | Keep the modern SaaS visual language but omit accounts, collaboration, remote publishing, and cloud assumptions in WI-2; evaluate them only in the separately approved SaaS program. |
| Tailwind baseline/reset affects legacy screens | Native controls or CSS Module layouts could change before migration | Audit representative routes during UI-01, preserve the global accessibility baseline, and roll out by complete component/feature boundary. |
| Tailwind and CSS Modules coexist temporarily | Duplicate tokens, specificity conflicts, or dead styles could accumulate | Use one token source, prohibit mixed ownership on the same element, and remove legacy rules only after verified migration. |
| Next.js is mistaken for part of WI-2.1 | Scope could expand into routing/runtime/deployment changes | PD-UI-15 retains Vite/React for WI-2.1; PD-UI-19 requires a separate future architecture proposal. |

## 12. Confirmed decisions and remaining dependencies

PD-UI-01 through PD-UI-20 are recorded in `product-owner-decision-register.md`. They close the earlier questions about terminology, provisional visual direction, create-and-generate behavior, generation completion, bulk approval, facts placement, manual import placement, mobile scope, success metrics, Stitch direction, WI-2.1 frontend architecture, styling migration, and future SaaS portability boundaries.

Remaining design dependencies are recorded in `open-design-dependencies.md`:

- Official logo, final palette/type rules, brand templates, and KETSI assets/usage rules.
- Selected Google Stitch concept and its adopt/adapt/defer/reject evaluation.
- Representative creator access for workflow validation.
- Confirmed persistence behavior before the UI promises direct text/graphic editing.
- Later format-specific template, safe-zone, approval, packaging, and copy decisions.

## 13. Static content format roadmap

The supported target is:

- Carrusel 4:5, 1080 × 1350, multiple ordered images — current WI-1 baseline.
- Publicación 4:5, 1080 × 1350, single static image — future.
- Publicación 1:1, 1080 × 1080, single static image — future.
- Historia 9:16, 1080 × 1920, single static image — future.
- Portada para Reel/TikTok 9:16, 1080 × 1920, single static image only — future, never video.
- Text content — headlines, captions, supporting descriptions, hashtags, and approved copy variations.

The current project model, contract, content structure, template registry, review routes, final approval, and export packaging are carousel-centric. A later SF-00 architecture phase must define additive content-type/canvas/asset concepts, migration defaults, format-aware templates and QA, approval/trace rules, and download packaging before any new format becomes selectable. `static-content-format-roadmap.md` contains the full gap analysis and SF-00 through SF-05 sequence.

No new format work may introduce social account connections, credentials, uploads, publishing, scheduling, analytics, or video/audio/animation/timeline capabilities.

## 14. Google Stitch relationship

The Product Owner selected a hybrid visual direction using Option A’s premium dark sports identity and Option B’s clear, intuitive experience. Google Stitch is a visual reference, not an architecture or code replacement:

- Compare it with the five-stage IA, current React/Router/component boundaries, current API responses, and route compatibility.
- Preserve every WI-1 state, error, data mode, verification rule, approval rule, export record, and security control.
- Evaluate keyboard/focus order, semantic structure, reflow, target sizes, contrast, status announcements, and reduced motion.
- Classify each concept element as adopt, adapt, defer, or reject.
- Do not copy unsupported social publishing, account, video, bulk approval, or direct-edit controls.
- Do not accept generated dependencies, remote assets, or architectural replacements without a separate justified decision.

The detailed checklist is in `open-design-dependencies.md`. Tailwind implements the approved system through local tokens/components; it does not make Stitch-generated markup or code authoritative.

## 15. Frontend architecture boundary

- WI-2.1 stays on React 19, React Router, Vite, TypeScript, and the current typed same-origin API.
- Tailwind CSS v4 is added during UI-01 only after explicit implementation approval and normal dependency controls.
- CSS Modules remain during the incremental migration and may remain for specialized styles where that is clearer.
- Next.js is a future architecture candidate outside WI-2.1. No Next.js routing, server rendering/components/actions, hosting, or runtime change is planned here.
- A future Next.js proposal must establish a concrete benefit over the local Vite SPA and assess loopback/local serving, Fastify integration, routes, security, API boundaries, build/deployment, caching, testing, and migration cost.
- Next.js is the Product Owner's preferred candidate for a possible future commercial SaaS web application, subject to a separate architecture decision and migration plan.
- Components should not own route mechanics when navigation can be supplied by route-level composition; business/domain rules remain outside framework-specific presentation code.
- Generation workflows should depend on provider-neutral capabilities rather than AI vendor SDKs, brand configuration should remain replaceable independently of application theme, and domain logic should not assume local persistence semantics.
- These are portability guardrails for changed code, not authorization to add users, tenants, authentication, billing, cloud storage, hosted operations, or other SaaS behavior during WI-2.

Detailed future decisions, prerequisites, and migration gates are recorded in `future-saas-readiness-considerations.md`.

## 16. Repository status and safe implementation workflow

- The audit started from a clean `main` at commit `c60fec9`.
- `work/WI-1` at `b3a50d2` is an ancestor of `main`; merge commit `2e6f423` and closure commit `c60fec9` confirm WI-1 is merged and closed.
- These proposal files were placed on `work/WI-2.1`; no application source was changed.
- After Product Owner approval, continue on a WI-2 work branch from the current `main` baseline. Keep UX foundation, workflow, review, and configuration changes in reviewable phases rather than one cross-application change.
- Before each phase, recheck `main`, rebase or merge the approved baseline according to the repository policy, and run the existing typecheck, lint, unit, integration, contract, end-to-end, and accessibility gates appropriate to the change.
- Do not merge, push, or deploy until the Product Owner approves implementation and the relevant phase passes review.

