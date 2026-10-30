# WI-2.1 — Incremental UX/UI Implementation Plan

Status: UI-01A, UI-01B, UI-02, UI-03, UI-04A, UI-04B, and UI-05A accepted; UI-05B not started
Date: 2026-10-29

## 1. Delivery principles

- Keep every phase independently reviewable and reversible.
- Preserve existing routes and API contracts during the initial redesign.
- Keep current WI-1 behavior available while new presentation layers are introduced.
- Do not combine the first visual redesign with the architecture work for additional static formats.
- Keep React, React Router, Vite, TypeScript, typed contracts, and existing testing tools for WI-2.1.
- Introduce Tailwind CSS v4 only in UI-01 after explicit implementation approval. It is the approved exception to the previous dependency-minimization guidance.
- Migrate styling incrementally; Tailwind and CSS Modules coexist until each complete component/feature slice is verified.
- Preserve future SaaS portability through clear boundaries, without adding SaaS features or speculative infrastructure during WI-2.
- Keep safety-critical statuses and approval gates visible even when technical detail is collapsed.
- End every creator journey at **Descargar contenido**, never at publishing or scheduling.
- Follow PD-UI-21 for verification and acceptance on UI-03 and later tasks: Codex runs typecheck, affected-code ESLint, relevant unit/component tests, build when appropriate, and `git diff --check`; Product Owner owns functional E2E and visual acceptance.
- Prefer targeted checks and reuse valid results. Do not automatically run Playwright E2E, browser accessibility, visual regression, or repeated multi-viewport screenshot suites. For critical behavior, contracts, authentication, security-sensitive work, or shared infrastructure, explain the need and exact commands and request authorization before expensive browser/E2E checks. Keep existing E2E infrastructure intact.

## 2. Pre-implementation design gate

Before UI-01 begins:

1. Product Owner explicitly approves implementation.
2. Record the selected hybrid Google Stitch frames/export used for review, if pixel-level comparison is expected.
3. Evaluate the selected hybrid concept using the checklist in `open-design-dependencies.md`.
4. Confirm which official logo/brand assets are available; otherwise use neutral placeholders and the approved provisional tokens.
5. Produce low-fidelity flows for the five stages and test them with representative creators.
6. Capture a live responsive/accessibility baseline of the current application when dependencies are available through the normal project setup.

## 3. UI phases

### UI-01 — Design tokens, shared components, and application shell

Outcome: a reusable premium sports-studio foundation without changing workflows.

Increment split:

- **UI-01A — foundation (accepted by Product Owner):** Tailwind CSS v4/Vite integration, centralized tokens, controlled legacy aliases, preflight decision, Button, IconButton, Card, Badge, Input, Select, Textarea, Alert, EmptyState, LoadingState, tests, and an isolated review gallery.
- **UI-01B — shell (implemented, verified, and accepted):** application shell, primary navigation, route-derived project context, responsive disclosure, and breadcrumbs. Feature screens remain unchanged.

The UI-01B scope is in `ui-01b-shell-and-navigation-scope.md`; results and acceptance are in `ui-01b-shell-implementation-report.md`. UI-02 was subsequently authorized from checkpoint `6aff775`, accepted by the Product Owner, and checkpointed at `41ea6f70aba4a58df1d5604f1956b4e660dbbf4a`; see `ui-02-creator-dashboard-implementation-report.md`. UI-03 was visually accepted on 2026-10-29 on its dedicated branch; see `ui-03-guided-content-creation-implementation-report.md`. UI-04A was authorized from UI-03 checkpoint `7b1daf1` on `work/WI-2.1-ui-04` and accepted by the Product Owner on 2026-10-29. See `ui-04a-review-workspace-implementation-report.md`. UI-04B is prepared as the next increment; it must begin from the accepted UI-04A checkpoint after its separately required API/data semantics are defined.

Scope:

- Add and configure Tailwind CSS v4 for the existing Vite SPA, with exact dependency versions and normal lockfile/security controls.
- Establish Design Tokens as the single source of truth, exposed through CSS custom properties and mapped to Tailwind utilities.
- Provisional purple/gold/electric-blue/dark-neutral tokens and Montserrat/Inter typography.
- Semantic status tokens kept independent from brand colors.
- Shared button, link-button, field, alert, status, card, disclosure, breadcrumb, loading, error, empty-state, and responsive table primitives.
- Branded application shell, primary **Crear contenido** action, top-level Proyectos and Datos, and brand/template access.
- Project context header and responsive navigation foundations.
- Existing skip link, landmarks, route focus behavior, no-login/local-only messaging, reduced motion, and accessible names.
- Controlled Tailwind/CSS Modules coexistence and the first migration slices: shared primitives and shell. Existing feature modules remain until their later phase.
- Baseline/reset audit so native controls, tables, headings, images, focus styles, and legacy routes do not regress.
- Keep shared visual primitives independent of route objects where practical; route-level screens compose navigation, data access, and domain actions. This is a portability guardrail, not a new abstraction or SaaS implementation track.

Out of scope:

- Workflow reordering.
- New formats.
- New editing behavior.
- Official logo or KETSI invention.
- Big-bang conversion or deletion of all CSS Modules.
- Next.js or any frontend framework/router migration.
- Authentication, user/team/tenant management, billing, cloud persistence, SaaS hosting, or tenant-aware behavior.
- A speculative rewrite of domain, provider, or persistence layers solely for future SaaS use.

Review evidence:

- Existing routes and behavior remain functional.
- Component states are documented in a review page or test fixtures.
- Keyboard, focus, contrast, target size, 200% zoom, and reduced-motion checks.
- Tailwind production build works through the existing Vite pipeline; exact dependencies are pinned and repository dependency/security checks pass.
- Untouched CSS Module screens remain visually and behaviorally stable inside the new shell.
- Token use and migration boundaries conform to `tailwind-v4-migration-strategy.md`.

### UI-02 — Dashboard and content creation entry point

Delivery status: implemented, verified, and accepted by the Product Owner on 2026-10-29. Approval summary data supports four conservative states; run progress/failure remains in project details. Only the existing carousel flow is enabled.

Outcome: the creator can begin and resume work without interpreting an operational table.

Scope:

- Responsive project cards/hybrid list with status, format, competition, last activity, and Continue action.
- Filters limited to actionable creator states rather than analytics.
- **Crear contenido** entry point.
- Stage 1 shell and format selection architecture; only implemented formats are enabled.
- Use Proyecto only for the saved workspace.
- Creator-facing status/copy mapping that hides runs, providers, IDs, and versions by default.

Out of scope:

- Enabling non-carousel formats.
- Dashboard analytics or performance metrics.
- Remote analytics tracking.

Review evidence:

- First-time creator can identify the starting action and resume an existing project.
- Empty, loading, error, populated, long-title, and mobile-browsing states.

### UI-03 — Competition selection and data confirmation

Delivery status: implemented, verified, and visually accepted by the Product Owner on 2026-10-29. The guided definition and data-confirmation flow is limited to the supported Instagram carousel. Match results are not available from the pre-generation catalogue APIs, so the interface states that they will be consulted when generation starts instead of fabricating a preview.

Outcome: the creator defines a carousel and confirms trustworthy data in a guided path.

Scope:

- Stage 1 competition/season/stage/matchday/language flow with sensible defaults.
- Stage 2 creator choices for automatic, manual, and demonstration data.
- Readable match/standings preview and data-readiness summary.
- Detailed verification as a secondary view.
- Contextual entry to the existing JSON/CSV/form importer and return to the selected-data preview.
- One **Confirmar datos y generar** action that later sequences current project creation + generation behavior.
- Recoverable partial-success UI when the project is saved but generation fails.

Out of scope:

- Changing validation, verification, or provider logic.
- New input formats or data providers.
- Contract changes.

Review and verification:

- UI-03 visual acceptance is complete. Functional E2E ownership follows PD-UI-21.
- Technical verification for subsequent UI tasks follows the targeted checks in Delivery principles. Additional expensive browser/E2E verification for critical or shared behavior requires presenting exact commands and receiving authorization first.
- Existing E2E infrastructure and test cases remain available for manual execution.

### UI-04 — Visual content editor

Delivery status: UI-04A is accepted on `work/WI-2.1-ui-04`; UI-04B bulk approval is accepted on `work/WI-2.1-ui-04b`; UI-05A export reliability/download is accepted and committed on `work/WI-2.1-ui-05a`; see `ui-05a-export-reliability-implementation-report.md`. UI-05B has not started. Automated E2E and browser accessibility suites are not run under PD-UI-21; targeted component tests and technical checks are recorded in each increment report.

Outcome: a creator can preview, customize, review, and approve the existing carousel efficiently.

Scope:

- Desktop three-panel layout: asset rail, preview, inspector.
- Tablet preview/inspector adaptation and mobile review-focused mode.
- Accurate 4:5 carousel preview.
- Existing text fields presented as editable only where a supporting save contract/behavior exists; otherwise use clear review/regenerate controls. Do not create a deceptive editable control.
- Template and authorized brand presentation using current capabilities.
- Provenance, blocking facts, QA, warnings, and technical versions through progressive disclosure.
- **Aprobar y siguiente**, individual approval/withdrawal, regeneration, caption approval, explicit final approval, and confirmed bulk approval of eligible slides.
- Completion gate with **Descargar contenido** as the next action.

Out of scope:

- Direct manipulation or freeform graphic editing without supporting behavior.
- New static formats.
- Video controls.

Review evidence:

- Approval semantics match WI-1 exactly.
- Edits/regeneration invalidate affected approvals.
- Keyboard order follows the visual workspace.
- Carousel with maximum slide count remains usable.
- Single-image editor mode is designed/documented but not enabled until the format architecture exists.

Capability split:

- **UI-04A, current-contract review workspace:** deliver the three-panel experience with preview, issues, regeneration, approval, withdrawal, and final approval.
- **UI-04B, bulk approval:** let creators approve all currently eligible slide versions after an accessible confirmation summary. Reuse the existing per-version approval operation sequentially, preserve each server guard, report partial failures, and keep caption and final approval independent. No new API contract is planned unless code inspection shows the existing operation cannot support safe partial results.
- Direct editing, per-asset template selection, and brand-style choices remain future capabilities requiring a separate additive API/data proposal for immutable versions, validation, provenance/fact preservation, rendering, QA, concurrency, and approval invalidation.

### UI-05 — Download, history, and manual-data management UX

Outcome: downloading is a clear final step, and data/history tools are usable without dominating creation.

Scope:

- Rename the creator-facing final action to **Descargar contenido**.
- Download readiness, success summary, images/text/manifest contents, and retry.
- Simplified project/export history with technical metadata in details.
- Immutable export detail and trace preserved.
- Dedicated Datos section with Importar, Historial, and Versiones views.
- Improved JSON/CSV guidance and grouped advanced form entry.
- Post-import **Crear contenido con estos datos** continuation.
- Separate brand assets and templates views where appropriate.

Out of scope:

- Publishing, scheduling, social credentials, or upload.
- Changing export storage, deletion policy, hashes, or trace model.

Review evidence:

- Download succeeds without publication language anywhere in the primary journey.
- Exact exported versions and trace remain accessible.
- Manual data can be reached both contextually and from Datos.

### UI-06 — Responsive, accessibility, and regression hardening

Outcome: the redesigned carousel workflow is production-ready within the existing local architecture.

Scope:

- Desktop/tablet creation and editing validation.
- Mobile navigation, project browsing, preview, review, approval, and download.
- Explicit limitation/hand-off for advanced mobile editing.
- WCAG 2.2 AA checks: keyboard, focus appearance, target size, reflow, text spacing, status messages, forced colors, reduced motion, and 200% zoom.
- Long Spanish/English copy, 20 slides, maximum fact/import-error sets, slow/failing states, and interrupted generation.
- Unit, integration, contract, E2E, and axe regression appropriate to changed code.
- Targeted visual screenshot baselines after visual direction stabilizes.

Out of scope:

- New formats and their backend architecture.

Review evidence:

- First-time time-to-download usability benchmark.
- No serious/critical axe violations and no manual keyboard/reflow blockers.
- All existing security and contract gates pass.

## 4. Separate static-format track

SF-00 through SF-05 in `static-content-format-roadmap.md` begin only after the initial carousel redesign is stable and a separate architecture/contract proposal is approved. Those work items may require additive contracts, migrations, rendering templates, QA rules, review generalization, and export packaging. They must not be folded into UI-01 through UI-06.

## 5. Styling migration across UI phases

- **UI-01:** Tailwind v4 foundation, tokens, shared primitives, shell, coexistence rules.
- **UI-02:** migrate dashboard and Crear contenido entry components; remove only their unused legacy rules.
- **UI-03:** migrate selection/data-confirmation surfaces while preserving form semantics and import behavior.
- **UI-04:** migrate the review/editor workspace as a complete responsive slice; retain specialized CSS where utilities reduce clarity.
- **UI-05:** migrate download/history/import/brand screens by feature boundary.
- **UI-06:** audit remaining CSS Modules, conflicts, duplication, unused selectors, generated CSS, visual baselines, and accessibility.

The detailed sequence, definition of done, coexistence rules, and rollback controls are in `tailwind-v4-migration-strategy.md`.

## 6. Relationship between WI-1 and UI phases

| WI-1 capability | WI-2 presentation improvement | Preserved control |
| --- | --- | --- |
| Dynamic competition catalogue | Guided selection with defaults and summaries | No hardcoded competition; same selection data. |
| LIVE/MANUAL/DEMO modes | Three creator-friendly choices | Same configured sources, mode recording, and warnings. |
| Workflow runs/stages | Plain-language generation progress | Same persisted stages, polling, failure, retry, and diagnostics. |
| Facts/evidence/disputes | Data-readiness summary + secondary details | Same verification and blocking logic. |
| Manual approvals | Concise attention workflow | Same eligibility, confirmation, revocation, and attested semantics. |
| Carousel drafts/elements | Visual editor workspace | Same ordering, versions, fact bindings, and generated files. |
| Visual QA/content flags | Inspector issues and resolution | Same warning acknowledgement and blockers. |
| Per-item/final approval | Aprobar y siguiente + final gate | Same individual operations and invalidation; no bulk. |
| Export/history/trace | Descargar contenido + creator-first success view | Same exact version set, manifest, hashes, local files, and trace. |
| Brand registry/templates | Brand/template panels | Only authorized assets; no invented logo/KETSI. |

## 7. Phase-level risks

- Visual refactoring across all features can create large test churn; keep each phase route-compatible and behavior-first.
- “Editable” text/graphics require real persistence semantics; do not imply changes are saved when the current API only supports regenerate/approve.
- Create-and-generate sequencing can partially succeed; recovery is a required acceptance state, not an edge case.
- Progressive disclosure must never hide a blocker at approval/download time.
- Stitch concepts may contain unsupported controls or inaccessible spatial patterns; treat them as visual references, not source architecture.
- Official brand assets may arrive after UI-01; token and asset slots must allow replacement without redesign.
- Tailwind baseline/reset or utility specificity may alter legacy CSS Module screens; audit first, keep explicit ownership boundaries, and migrate by complete slice.
- A parallel Tailwind/CSS Modules period can create duplicate values; enforce token ownership and remove legacy rules only after the owning slice passes.
- Tailwind requires a dependency/lockfile change during UI-01 implementation; exact packages and versions must follow repository pinning, audit, and approval controls.
- Next.js discussions must not expand WI-2.1; any framework migration is a future architecture work item.
- Portability guidance can become over-engineering; apply it at changed boundaries only and do not create unused tenant, identity, provider, or storage abstractions in WI-2.

## 8. Future SaaS boundary

The possible commercial SaaS evolution is documented in `future-saas-readiness-considerations.md`. UI-01 through UI-06 may preserve clean seams while modifying components, but they must not deliver SaaS-specific capabilities. A future program must separately approve the product model, tenancy and identity boundaries, security model, persistence, operations, contracts, migration sequence, and any Next.js adoption.

