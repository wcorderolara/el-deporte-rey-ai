# WI-2.1 — Product Owner Decision Register

Status: UI-01A, UI-01B, UI-02, UI-03, UI-04A, UI-04B, and UI-05A accepted
Date: 2026-10-29
Source: Product Owner design-refinement brief for WI-2.1

## 1. Product vision decision

El Deporte Rey AI is an AI-assisted sports content creation studio. It transforms supported sports information into professional static graphics and written social-media copy for download. The primary user is a non-technical sports content creator working for El Deporte Rey.

The product owns the workflow from sports information through creation, customization, review, approval, and downloadable assets. Publication is always completed manually by the user or their team outside the application.

The governing principle is:

> From sports information to downloadable creative assets in the fewest reasonable steps.

The platform is not a social-media management, publishing, scheduling, analytics, messaging, comment-management, video-generation, video-editing, animation, or timeline-editing product.

## 2. Confirmed decisions

| ID | Confirmed decision | UX and architecture consequence |
| --- | --- | --- |
| PD-UI-01 | Use **Crear contenido** as the primary action. Let the user choose Carrusel, Portada para Reel, Historia, or Publicación in the creation flow. Use Proyecto only for the saved workspace. Hide execution/run/provider/fact-key/version/ID terminology unless technical details are opened. | Global CTA and creation headings use “Crear contenido.” Existing backend names and IDs remain unchanged. Nonimplemented formats are not presented as usable actions until their format work item is delivered. |
| PD-UI-02 | Approve provisional deep purple, gold, electric blue, white, dark neutral surfaces, Montserrat headings, and Inter UI/body text. The experience must be premium, energetic, sports-oriented, and not a generic enterprise dashboard. | UI-01 may implement provisional tokens and typography. Semantic verification/error/demo/attested colors remain distinct. Official assets can replace placeholders without restructuring components. |
| PD-UI-03 | Use a simple guided workflow with sensible defaults and optional customization. | The primary path has one recommended next action, summary-first data, and progressive disclosure. |
| PD-UI-04 | Preserve LIVE_DATA, MANUAL_DATA, and DEMO_DATA, shown as “Obtener resultados automáticamente,” “Cargar resultados manualmente,” and “Probar con datos de demostración.” Do not require adapter knowledge. Manual import remains a practical fallback. | Data mode is a creator choice; source/adapter metadata is secondary. Existing source selection, mode recording, and verification rules remain intact. |
| PD-UI-05 | Project creation and generation operate as one guided action after data confirmation. Failures remain visible and recoverable. | The client may later sequence existing create-project and start-run calls. A successful project creation followed by failed generation must land in the saved project with a clear retry state. No API change is implied for the initial redesign. |
| PD-UI-06 | When generation finishes, show completion, previews, and a prominent **Revisar contenido** action. Do not redirect automatically. | Generation stays on its completion screen until the user chooses to continue. |
| PD-UI-07 | Preserve individual asset/caption approval, explicit final approval, regeneration, withdrawal, QA warnings, and invalidation. Prefer **Aprobar y siguiente**. Do not implement bulk approval yet. | Review optimizes sequential inspection but sends the same existing item-level operations. No bulk approval control belongs in UI-04. |
| PD-UI-08 | Show a simple data-readiness summary in the main flow. Keep verification sources, records, and provenance in secondary views. Never mislabel unverified data. | Blocking or unsafe states stay visible at decision points. Evidence, disputes, fact keys, and references move behind deliberate detail actions rather than disappearing. |
| PD-UI-09 | Manual import is core and available both inside creation and in a dedicated data-management section. Preserve JSON, CSV, form entry, and existing validation semantics. | “Datos” is a first-class navigation destination, not only a Settings subsection. Creation can enter or return from the same import workflow with context. |
| PD-UI-10 | Prioritize desktop/tablet creation and visual editing. Mobile supports navigation, project browsing, review, preview, and download; advanced editing is not required initially. | The responsive editor becomes full-featured at tablet/desktop and a focused review/download experience on phones. |
| PD-UI-11 | Use official El Deporte Rey logo, palette, typography, templates, and KETSI when supplied. Do not invent a logo or redesign KETSI. Use suitable placeholders meanwhile. | Placeholder components must be asset-neutral and clearly provisional. No generated substitute brand marks or mascot art. |
| PD-UI-12 | Export is the final product step and the primary final action is **Descargar contenido**. Never say Publicar, Publicar en Instagram, or Programar publicación. | User-facing export language becomes download-oriented. Existing internal export records, manifests, and API operation names remain unchanged. |
| PD-UI-13 | Primary success metric: successful time-to-export for a first-time creator. Secondary: completion, unnecessary decisions/interactions, approval friction, recovery time, and confidence. | Usability validation and phase acceptance measure creation-to-download, not engagement, publishing, or dashboard activity. |
| PD-UI-14 | Adopt a hybrid Google Stitch visual direction combining Option A’s premium dark sports identity with Option B’s clear and intuitive experience. | Dark, energetic, high-contrast creative-studio surfaces provide identity; task hierarchy, readable content, familiar controls, and progressive disclosure provide usability. Stitch remains a visual reference, not generated production architecture. |
| PD-UI-15 | Retain React, React Router, Vite, and TypeScript for WI-2.1. Do not replace the current frontend framework during the redesign. | UI-01 through UI-06 evolve the existing SPA incrementally, preserving routes, contracts, tests, local serving, and security boundaries. |
| PD-UI-16 | Adopt **Tailwind CSS v4** as the target styling foundation beginning in UI-01. | UI-01 may add the approved Tailwind dependency/integration only after implementation approval, with exact version pinning, lockfile/audit controls, and no application/backend contract change. |
| PD-UI-17 | Establish **Design Tokens** as the single source of truth for brand and semantic styling. | Brand, surface, text, state, typography, spacing, radius, elevation, layout, and motion tokens map to CSS custom properties and Tailwind utilities. Components must not duplicate raw values when an approved token exists. |
| PD-UI-18 | Migrate from CSS Modules to Tailwind incrementally; do not perform a big-bang rewrite. | CSS Modules and Tailwind coexist during WI-2.1. Migrate shared foundations and one reviewable vertical slice at a time; remove a module only after visual, responsive, behavior, and accessibility equivalence is verified. |
| PD-UI-19 | Record Next.js as a possible future architecture improvement outside WI-2.1. It is not approved for the current redesign. | No Next.js dependency, routing, server-rendering, hosting, or application migration belongs in UI-01 through UI-06. A future architecture decision must demonstrate product benefit and assess local-first runtime, security, routing, build/deployment, API, and test implications. |
| PD-UI-20 | Preserve architectural portability toward a possible commercial, multi-user, multi-tenant SaaS product while keeping WI-2 focused on the internal tool. Next.js is the preferred candidate for that future web application, not an approved WI-2 migration. | New UI work should avoid unnecessary coupling between components and routing, domain/business logic and the frontend framework, AI providers and generation workflows, brand configuration and application theme, and local persistence and domain logic. Do not add authentication, users, tenants, organizations, billing, cloud persistence, SaaS hosting, or other SaaS-specific behavior during WI-2. |
| PD-UI-21 | The Product Owner owns functional E2E testing and visual acceptance for UI-03 and subsequent WI-2.1 UI tasks. Codex must not automatically run Playwright E2E, browser accessibility, visual regression, or repeated multi-viewport screenshot suites. | After each UI task, Codex runs TypeScript typecheck, ESLint for affected code, relevant unit/component tests, production build when appropriate, and `git diff --check`. Prefer targeted checks and reuse valid results. For critical behavior, API contracts, authentication, security-sensitive functionality, or shared infrastructure, Codex explains the extra verification and exact commands, then requests authorization before expensive browser/E2E checks. Existing E2E infrastructure remains available and is not disabled. Each task remains pending Product Owner acceptance until explicitly approved. |

## 3. Confirmed product scope

### In scope

- Selecting competition, season, stage, and matchday.
- Automatic sports-data retrieval through supported APIs.
- JSON, CSV, and form-based manual sports-data import.
- AI-assisted headlines, summaries, descriptions, captions, hashtags, and platform-oriented copy variations.
- Static carousels, individual graphics, Reel/TikTok covers, Stories, square/portrait posts, and text deliverables.
- Brand templates, visual styles, text/graphic customization, review, approval, local export, project history, and export traceability.

### Intentionally out of scope

- Social-account connections or credentials.
- Automatic publishing, uploading, or scheduling.
- Social account, message, comment, or analytics management.
- Finished-video generation, video editing, animation, audio, or timelines.

Static 9:16 Reel/TikTok covers are image deliverables only. The product must never imply that it creates a Reel, TikTok video, animation, or finished video.

## 4. Supersession of earlier open decisions

The prior audit is retained. These decisions close or refine its Product Owner questions:

| Previous question | Resolution |
| --- | --- |
| Proyecto or Carrusel terminology | Superseded by PD-UI-01: primary action is Crear contenido; Proyecto is the saved workspace; format is chosen inside creation. |
| Provisional visual direction | Approved by PD-UI-02; official assets and final guidelines remain a dependency under PD-UI-11. |
| Automatically start generation after project creation | Approved by PD-UI-05 after data confirmation, with recoverable partial success. |
| Redirect automatically after generation | Rejected by PD-UI-06; show completion and Revisar contenido. |
| Bulk approval | Deferred by PD-UI-07; implement Aprobar y siguiente only. |
| Facts as primary step or details | Refined by PD-UI-08: data readiness is primary; detailed verification is secondary. |
| Manual import navigation | Refined by PD-UI-09: dedicated Datos destination plus contextual creation path; not buried exclusively under Settings. |
| Mobile scope | Resolved by PD-UI-10: browse/review/preview/download on mobile; advanced editing is desktop/tablet first. |
| Main success metric | Resolved by PD-UI-13: successful first-time time-to-export. |

## 5. Relationship to the WI-1 Source of Truth

The decisions refine presentation and future scope without silently changing WI-1 behavior:

- The WI-1 baseline is React, React Router, Vite, TypeScript, CSS Modules, and the typed same-origin API; application behavior remains on that foundation while styling migrates incrementally.
- PD-UI-15 retains React, React Router, Vite, and TypeScript for WI-2.1. PD-UI-16 through PD-UI-18 add Tailwind CSS v4 and token-driven styling incrementally; CSS Modules remain supported during migration.
- The local single-operator, no-login, loopback-bound security model remains.
- HTTP v1 remains additive-only; no contract change is authorized in WI-2.1 design refinement.
- LIVE_DATA, MANUAL_DATA, and DEMO_DATA still produce the same provider-neutral sports domain.
- Verification, disputes, manually approved/operator-attested semantics, publishability guards, and source-permission controls remain authoritative even though the creator-facing product says download rather than publish.
- Existing per-item/final approval, deterministic rendering, visual QA, immutable export history, and traceability remain.
- Only authorized assets may be used. No club/competition marks, replacement logo, or replacement KETSI are introduced.
- DEMO_DATA remains visibly synthetic and unsuitable for real publication.
- No new input type, provider, shared-host model, credential behavior, or contract is approved by this decision register. No new dependency is approved except the Tailwind CSS v4 integration category explicitly recorded by PD-UI-16.
- Tailwind CSS v4 is the sole newly approved frontend dependency category for UI-01. It is not installed by this documentation decision; exact packages/versions and lockfile changes require implementation approval and the repository dependency controls.
- Next.js remains outside WI-2.1 and does not alter the current architecture or Source of Truth.
- SaaS readiness is a portability constraint, not a current runtime or product capability. The local single-operator security and persistence model remains authoritative until a separate architecture and product program is approved.

## 6. Contradiction assessment and supersession

| Earlier statement | Resolution |
| --- | --- |
| Prefer CSS custom properties without adding a UI dependency | Partially superseded by PD-UI-16: Tailwind CSS v4 is approved for UI-01. CSS custom properties remain the runtime/token interoperability layer, not the complete styling approach. |
| Use existing CSS Modules throughout UI phases | Refined by PD-UI-18: existing modules remain until their owning components are migrated and verified; new/redesigned components target Tailwind. |
| Add no dependency unless separately justified | Satisfied: this Product Owner decision is the explicit justification for Tailwind. Exact dependency changes still follow pinning, audit, and review policy. |
| Selected Stitch concept was an open dependency | Closed at direction level by PD-UI-14: the hybrid A+B direction is selected. Exact Stitch frames/export remain a reference input if pixel-level comparison is expected. |
| Future framework modernization could occur during redesign | Explicitly excluded by PD-UI-15 and PD-UI-19: Vite/React remain for WI-2.1; Next.js requires a future architecture work item. |
| Future SaaS direction conflicts with the current local-only model | No conflict: PD-UI-20 preserves seams that reduce future migration cost but does not change current users, hosting, persistence, authentication, API, or security behavior. |

No conflict was found with the product scope, data/verification model, approval rules, export-only boundary, accessibility requirements, security constraints, or additive-only API policy.

## 7. Decision status

PD-UI-01 through PD-UI-21 remain confirmed. The Product Owner personally reviewed the local gallery, approved the visual result, accepted UI-01A, and authorized its commit on the current feature branch. The subsequent UI-01B directive authorized shell/navigation implementation from checkpoint `4c78b36`. The Product Owner then confirmed the shell looks good without problems and requested closure and progression to the next increment. UI-01B is accepted at `6aff775`. UI-02 retained all contracts and current carousel creation; the Product Owner confirmed visual acceptance on 2026-10-29. Its committed checkpoint is `41ea6f70aba4a58df1d5604f1956b4e660dbbf4a` on `work/WI-2.1-ui-02`. UI-03 was visually accepted by the Product Owner on 2026-10-29 on `work/WI-2.1-ui-03`; its implementation is closed at the accepted checkpoint recorded in Git. UI-04A was accepted by the Product Owner on 2026-10-29 and closed at the accepted checkpoint on `work/WI-2.1-ui-04`. UI-04B bulk approval was accepted by the Product Owner on 2026-10-30 and closed on `work/WI-2.1-ui-04b`; it reuses individual version approval guards and preserves partial results, with no bulk API contract. UI-05A export reliability was accepted by the Product Owner on 2026-10-30 after confirming ZIP download with all expected images, caption, and manifest; it is committed on `work/WI-2.1-ui-05a` (report: `ui-05a-export-reliability-implementation-report.md`). UI-05B was accepted by the Product Owner on 2026-10-30 after reviewing the project workspace, shared review-style export detail, and compact text-first export history. It is closed on `work/WI-2.1-ui-05b`; see `ui-05b-export-history-project-workspace-implementation-report.md`. UI-05B introduces no API contract. The Product Owner owns functional E2E testing and visual acceptance under PD-UI-21.

UI-06.1 (recovery of the E2E and accessibility suites) was accepted by the Product Owner on 2026-11-13 under the condition that the defect E2E-F01 found by the recovered suites is corrected first. E2E-F01 is corrected: every download of an approved carousel has the server write the export from the current state, so it carries only the editorial copy approved and publishable at that moment, without repeating the graphic final approval and without modifying earlier exports (source of truth PD-34; PD-33 Option A stays in force). The copy panel sentence that contradicted PD-33 is replaced. The findings A11Y-01, A11Y-02, R-02 and R-03 are assigned to UI-06.2 and stay open; WCAG 2.2 AA is not declared. UI-06.1 is closed on `work/WI-2-UI-06` in commit `bcdecc778e4f4680a23ad1c0ae7af35afc63c30a` over `9f5963f`; see `ui-06-1-e2e-a11y-recovery-report.md` (section 10). For UI-06 only, the Product Owner's instruction suspends PD-UI-21 so that the Playwright and accessibility suites run. UI-06.2 and UI-06.3 have not started and need the Product Owner's validation; UI-06 is not complete.

On 2026-11-13 the Product Owner confirmed the acceptance of UI-06.1 (closing record `cc0182d8f89940c42bdbaf8a85a4263f65a57474`) and authorized UI-06.2 (responsive adaptation and accessibility) with acceptance criteria AC-01 to AC-12: no redesign of approved screens, no new functionality or business rule, no `@fastify/static` update (its evaluation stays for UI-06.3), no change to the export policy, PD-33 or PD-34, no ZIP reuse, and O-1 and O-2 presented without assuming a product decision. UI-06.2 is implemented and verified and waits for the Product Owner's acceptance; it is not committed. See `ui-06-2-responsive-a11y-report.md`.

On 2026-11-13 the Product Owner accepted UI-06.2 («WI-2 / UI-06.2 — Aceptación y cierre técnico»), subject to the final verifications, and approved its seven corrected findings (A11Y-01, A11Y-02, A11Y-03, R-02, R-03, R-04 and R-05). The same instruction approved O-1 (the Mi marca note now says that team badges are managed in Competiciones, PD-28 and PD-32) and O-2 (the accessible names of the team actions carry the team's name, with no visible change), recorded as PD-35 in the source of truth and implemented before the closure. WCAG 2.2 AA is not declared from automated results alone. UI-06.2 is closed on `work/WI-2-UI-06` in commit `c2defce797f41546b195b2c899189c7eb971a643` over `cc0182d`; see `ui-06-2-responsive-a11y-report.md` (section 18). UI-06.3 has not started; UI-06 is not complete.

On 2026-11-13 the Product Owner authorized UI-06.3 («WI-2 / UI-06.3 — Regresión integral y estabilización final») as the final technical stabilization of the local version 1.0 and defined that version: image AI only for template proposals, structured templates made by the operator, deterministic rendering of the final slides without generative image AI, editorial AI for texts, independent approvals and manual publication (recorded as PD-36 in the source of truth). The instruction authorizes evaluating and, if it passes the checks, updating only `@fastify/static` to 10.1.11, and keeps PD-28, PD-33, PD-34 and PD-35, with no ZIP reuse and no cloud migration. UI-06.3 is implemented and verified and waits for the Product Owner's acceptance; it is not committed. See `ui-06-3-regression-stabilization-report.md`.

On 2026-11-13 the Product Owner changed the approach to L-01 (team names at the contract maximum): instead of only reducing the type size, allow a manually configured presentation name per team, used preferably in visual and engine templates, with the official name, the team identity and the badges by `teamId` kept, protected from provider synchronizations, recorded in the project snapshot, with the current name as fallback, no AI-invented abbreviations and no retroactive change; to be implemented only if it is low impact. No equivalent capability exists, and the minimal change needs a migration, an additive contract change, an amendment of BR-05 and PD-06 and changes in seven subsystems, so it is proposed as a separate refinement after UI-06.3 and was not implemented (`ui-06-3-regression-stabilization-report.md`, section 20).

On 2026-11-13 («WI-2 / UI-06.3 — Resolución final de pendientes») the Product Owner approved separating the presentation names as an independent initiative after UI-06.3, provisionally named TEAM-DISPLAY-01, not implemented, with a provisional policy (official name for identification and editorial copy, optional presentation name for visual content, association by `teamId`, historical snapshots protected, manual configuration) that authorizes no implementation and changes no historical rule; BR-05, PD-06, the sports contracts, the team schema, the snapshots and the name rules stay unchanged. The same instruction asked to resolve UI06.3-D06 without widening the contract or adding a sports rule (it needs a new exclusion reason in the contract, proposed and waiting for authorization), to fix the ZWJ emoji edit (the Product Owner authorized that day the minimal contract change, a pattern for the edited editorial text that also accepts U+200D) and the `copy-editorial.txt` heading (now with the matchday). See `ui-06-3-regression-stabilization-report.md`, section 21.

On 2026-11-13 («WI-2 / UI-06.3 — Autorización D06 y cierre final») the Product Owner accepted the corrections of UI06.3-D07 (ZWJ emoji edit) and UI06.3-D08 (copy heading) and authorized the additive contract change `score_not_supported` for UI06.3-D06 with the adjustments needed to integrate it, and no other sports rule. A local score above 99, which the frozen selection cannot record, is now excluded with that reason in the preview and the batch while the compatible matches are generated; the local result is kept; migration 0037 rebuilds the batch item tables so that their constraint accepts the reason, every row kept. With every check green, UI-06.3 is accepted and closed as a technical increment on `work/WI-2-UI-06` in commit `4ef6c0615a109e016928c180f0070aa8217205c7` over `3c11a9a`; see `ui-06-3-regression-stabilization-report.md` (section 22). WCAG 2.2 AA is not declared and version 1.0 has not passed a manual validation. TEAM-DISPLAY-01 stays pending and separate; CLOUD-ARCH-01 has not started; no later phase starts automatically.

On 2026-11-13 («TEAM-DISPLAY-01 completo en una sola entrega») the Product Owner authorized TEAM-DISPLAY-01 as one delivery on the new branch `work/TEAM-DISPLAY-01` from `b6579fd`: an optional presentation name per team, set by the operator in Competiciones, drawn in the team-name elements of the carousel images, recorded in the snapshot of each new project, accepted by the `team_names` check only for that team, never written by imports and never used for the editorial copy, the sports identity or the integrations. The exception to BR-05 and PD-06 is recorded as PD-37 in the source of truth, with the original rules kept. Implementation, tests and limitations: `../TEAM-DISPLAY-01/team-display-01-implementation-report.md`. It is not committed and waits for the Product Owner's acceptance; CLOUD-ARCH-01 has not started.

On 2026-11-16 the Product Owner validated TEAM-DISPLAY-01 functionally and approved it, and asked for its formal closure. During the validation the Product Owner also asked for four review adjustments, made on the same branch: «Aprobar todas (N)» as the gold primary action, a bulk approval of the editorial copy, the brand handle `@ElDeporteReyGT` accepted at the end of a sentence, and the download of one copy or of all of them apart from the slides (`../TEAM-DISPLAY-01/team-display-01-implementation-report.md`, section 12). TEAM-DISPLAY-01 is closed in commit `538da273985a1794ab063a93bba621f44aa706ee` of `work/TEAM-DISPLAY-01` over `b6579fd`, with migration 0038 and every historical snapshot kept. No merge, push or deploy; CLOUD-ARCH-01 has not started.

Later on 2026-11-16 the Product Owner asked to merge the accepted work into `main` and publish it: PD-ARCH-01, WI-2 and TEAM-DISPLAY-01 were merged into `main` (merge `c7014d4`) and pushed to `origin/main`, followed by the repository preparation (`b8243e1`) and the Spanish setup and operator guide (`471aeab`). No deploy. This supersedes the "no merge, push or deploy" of the previous paragraph, which described the state at the closure.

On 2026-11-16 («CLOUD-ARCH-01 — Decisión del Product Owner») the Product Owner reviewed the cloud architecture assessment (`../CLOUD-ARCH-01/cloud-architecture-assessment.md`), judged the migration technically viable and deferred its implementation. Version 1.0 keeps operating as a personal, local application with SQLite and the current file storage; no PostgreSQL adapter, cloud storage, contracted service or cloud resource. CLOUD-ARCH-01 stays an assessment completed with the migration deferred, and its analysis is kept for when the product needs remote deployment, multiple users or greater operational capacity. The next prioritized improvement is a local backup and restore mechanism reusing the current architecture; it does not start automatically. Recorded as PD-38 in the source of truth.

On 2026-11-16 («CLOUD-ARCH-01 — Aceptación y cierre formal») the Product Owner approved the assessment as the delivered work and made the decision final: the cloud migration is technically viable and its implementation is deferred; El Deporte Rey AI Studio keeps working locally with SQLite and the local file storage, and the priority is a personal, stable and functional application without unnecessary infrastructure or costs. **CLOUD-ARCH-01: CLOSED — PO ACCEPTED / IMPLEMENTATION DEFERRED.** The closing commit is `4430e98295b6c8384e9e6e50d780af6cbafad4d9` on `work/CLOUD-ARCH-01` over `471aeab`. The local backup and restore mechanism is recorded as the future improvement FU-16 in the source of truth; it is not started. Later the same day the Product Owner asked to merge it: `work/CLOUD-ARCH-01` was merged into `main` (merge `2bfdde2`). No deploy.

On 2026-11-16 the Product Owner asked for a README section on how someone else can continue the development with coding agents such as Codex or Claude Code, with the branch standard for accepting future Pull Requests, and for an `AGENTS.md` that points to what an agent must read; the Product Owner authorized the commits, the merge into `main` and the push. Recorded as CONTRIB-01 in the source of truth: `README.md` sections 13 and 14 and `AGENTS.md`. The branch standard is the one `.orchestrate/config.json` already defines (`work/<ID>`, `task/<ID>/<taskId>`, merge, push and deploy only with the Product Owner's authorization); no direct commit to `main`.
