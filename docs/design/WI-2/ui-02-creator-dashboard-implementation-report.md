# UI-02 — Creator Dashboard and Content Creation Entry

Status: Implemented and verified; awaiting Product Owner visual acceptance
Branch: `work/WI-2.1-ui-02`
Accepted UI-01B checkpoint: `6aff775887e93d427f228f81a92d336d8173dc1b`

## Baseline and scope

The work began from a clean `work/WI-2.1-ui-01b` with UI-01B already committed and accepted. No further UI-01B commit was needed. The dedicated UI-02 branch starts at that accepted checkpoint. All UI-02 application, test, documentation, and image changes remain uncommitted for Product Owner visual acceptance.

This increment replaces the administrative project table at `/` and `/projects` with one shared Creator Dashboard. Both existing entry routes remain. It preserves creation at `/projects/new`, project details, review, exports/history, data imports, and brand routes. No backend, contract, API-client, dependency, credential, or persistence changes were made.

## Creator experience

- Welcome: **Tu próximo contenido empieza aquí**, with the gold **Crear contenido** link to the existing creation form.
- Output explanation: static 4:5 carousels, images, text, hashtags, and manual publication outside the application.
- One library, retaining the API's newest-created-first order without fabricated activity timestamps or reordered duplicates.
- Responsive cards show competition, season, source-supplied phase/matchday, saved project title, language, approval-summary status, and one next action.
- The first non-exported project in API order receives **Para continuar**. This is a recommendation to resume, not a claim about the operator's last visit, last edit, or current generation progress.
- Native details retain the data source, acquisition mode, original approval label, creation time, latest historical export time, and access to export history.
- Demo content always has a visible symbol/text badge and synthetic-data warning. Manual data is never labelled verified.
- Loading, empty, and error states use accepted shared primitives. Retry follows existing error retryability; raw exceptions are not exposed.

## State and action mapping

The dashboard uses `ProjectSummary.approvalState`. The list does not include `latestRun`, current execution stages, QA blockers, asset URLs, last-edited time, or preview files. UI-02 deliberately does not issue a get-project request for every card.

| Existing summary | Creator label | Primary action | Existing destination |
| --- | --- | --- | --- |
| `no_draft` | En preparación | Continuar | `/projects/:id` |
| `in_review` | Pendiente de revisión | Revisar contenido | `/projects/:id/review` |
| `final_approved` | Listo para descargar | Descargar contenido | `/projects/:id/exports` |
| `exported` | Exportado | Ver contenido | `/projects/:id/exports` |

These labels describe the approval summary, not a new workflow state. No project is labelled **Generando contenido**, **Necesita atención**, or **Fallido** without the supporting execution data. A project with `no_draft` may be unstarted, running, or failed; its detail page remains authoritative for progress and restart controls. Review remains responsible for blockers, and exports remain responsible for current eligibility and creating/downloading files.

`lastExportAt` is explicitly labelled **Última exportación**. If absent, the card shows `createdAt` labelled **Creado**. No date is labelled last edit or last activity. Historical exports never upgrade the current approval state; regression coverage checks this explicitly.

## Design and architecture

The hybrid Stitch reference supplies dark studio surfaces, sports typography, violet depth, blue accents, and gold hierarchy. Existing Montserrat/Inter, palette, radii, spacing, motion, and semantic state tokens remain authoritative. The hero's decorative format illustration is CSS geometry only, hidden from assistive technology; it is not a fabricated project preview, logo, or mascot. No remote image or font dependency was introduced.

`ProjectCard` presents saved summary data. `dashboardModel` exhaustively maps the four contract approval values to text, tone, and route. It contains no persistence or provider behavior.

The accepted Button visual contract now exposes `buttonClassName` so React Router links can share the same token-backed variants without nesting buttons inside links or adding router imports to the primitives. Button behavior and existing variants remain intact.

`Layout` adds an explicit `contentVariant` slot. `AppShell` selects studio content only for the two dashboard entry paths (including the trailing-slash alias). Creation, project detail, review, export, import, and brand screens retain their legacy surface. The shell navigation and routes are unchanged. Route-loading text uses the appropriate existing color token for each surface.

## Controlled CSS migration

The dashboard no longer imports `Projects.module.css`. Only its unused `pageHeader`, `primaryLink`, and `sourceCell` rules were retired after replacement verification. The module itself remains because creation/detail/run components use its forms, tables, notices, buttons, and metadata patterns. No unrelated feature CSS Modules were migrated. Preflight remains disabled.

## Verification evidence

| Gate | Result |
| --- | --- |
| Root TypeScript typecheck | Passed. |
| ESLint and Prettier | Passed. |
| Frontend unit suite | 36 files, 497 tests passed. |
| Full unit suite | 117 files, 2,157 tests passed. |
| Production build | Passed for server, web, and contracts. |
| Functional E2E | 15 passed. |
| Accessibility and screenshot E2E | 33 passed, including all 12 dashboard state/viewport combinations. No serious/critical Axe violations; existing positive control still detects its seeded issue. |
| Responsive visual review | Reviewed populated at 1440/768/390px and desktop empty/loading/error. Three/two/one-column card layouts remain readable. All 12 browser checks found no global horizontal overflow. |

Tests cover all four approval states/actions, original metadata order, demo/manual distinctions, empty and loading states, safe errors/retry, and historical export timestamps that must not imply current readiness. The functional E2E assertions were adapted from table cells to card semantics while retaining data/language/export/history checks. Initial failures came from old row selectors and substring link matching; corrected selectors target headings, exact link names, and the preserved details disclosure.

Separate server integration/contract suites and dependency audit are skipped for UI-02 because backend, contracts, and dependencies are unchanged. Functional E2E uses the real existing backend with temporary fixture configuration/storage. Screenshot-specific responses are synthetic browser-intercepted list responses, never production fallback data.

## Screenshot evidence

`e2e/tests/dashboard.spec.ts` captures the populated, empty, loading, and HTTP 502 error states at 1440, 768, and 390px under `evidence/UI-02/`. Each state runs Axe and checks global horizontal overflow before capture. The screenshots are reproducible with `npm run test:a11y`; fixed synthetic dates and locally bundled fonts are used. Tests do not alter real user projects or credentials.

- [Projects — desktop](evidence/UI-02/dashboard-projects-1440.png)
- [Projects — tablet](evidence/UI-02/dashboard-projects-768.png)
- [Projects — mobile](evidence/UI-02/dashboard-projects-390.png)
- [Empty — desktop](evidence/UI-02/dashboard-empty-1440.png)
- [Loading — desktop](evidence/UI-02/dashboard-loading-1440.png)
- [Error — desktop](evidence/UI-02/dashboard-error-1440.png)

## Known limits

- No execution-progress/failure badge or dashboard restart mutation: summary data does not support them. Use project details.
- No rendered asset thumbnail: the summary provides no image URL. Cards represent saved creations through real metadata.
- No search/filter/analytics widgets were added; the current list API returns the complete library.
- Only existing carousel creation is enabled; other static formats remain a separate roadmap.
- Official logo/KETSI assets remain pending. The accepted text identity and provisional palette are preserved.
- Existing backend approval and export checks remain authoritative when the user follows a card action.

## File inventory

Application files:

- `apps/web/src/features/projects/ProjectListPage.tsx` — dashboard and async states.
- `apps/web/src/features/projects/ProjectCard.tsx` — new project card and metadata disclosure.
- `apps/web/src/features/projects/dashboardModel.ts` — new exhaustive status/action mapping.
- `apps/web/src/features/projects/Projects.module.css` — removes dashboard-only selectors.
- `apps/web/src/ui/primitives/Button.tsx` and `index.ts` — shared button/link visual contract.
- `apps/web/src/ui/Layout.tsx` and `apps/web/src/app/AppShell.tsx` — explicit studio surface for dashboard paths only.

Verification files:

- `apps/web/src/features/projects/ProjectListPage.test.tsx` and `apps/web/src/app/App.test.tsx`.
- New `e2e/support/dashboard-fixtures.ts` and `e2e/tests/dashboard.spec.ts`.
- Updated `e2e/tests/a11y.spec.ts`, `catalogue.spec.ts`, `delivery.spec.ts`, `manual-import.spec.ts`, `shell-responsive.spec.ts`, and `smoke.spec.ts`.

Design documentation: this report, README, decision register, redesign proposal, incremental plan, migration strategy, UI-02 scope, and twelve PNGs in `evidence/UI-02/`. No other application areas were changed.

## Local review

From the repository root run `npm run dev`, then open `http://127.0.0.1:5173/` (or `/projects`). This starts the existing development API and frontend workflow. Provider setup follows the existing configuration; UI-02 does not configure new services.

Running only `npm run dev:web` shows the shell but requires the existing local API at port 4300 for project data. With no backend, HTTP 502 is a development proxy failure and is displayed honestly with the safe error/retry state. No mock data is substituted into the application.

UI-03 has not started. No UI-02 commit, merge, push, or deployment is authorized before visual acceptance.
