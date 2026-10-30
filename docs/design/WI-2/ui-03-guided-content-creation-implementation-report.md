# UI-03 — Guided content creation and sports data confirmation

**Status:** Implemented, verified, and visually accepted by the Product Owner on 2026-10-29. The accepted implementation is closed at the UI-03 checkpoint on `work/WI-2.1-ui-03`.

## Git checkpoint

- Branch: `work/WI-2.1-ui-03`
- Baseline: accepted UI-02 commit `41ea6f70aba4a58df1d5604f1956b4e660dbbf4a` (`Adding the UI-02`)
- UI-02 was accepted by the Product Owner on 2026-10-29 and its checkpoint recorded in the decision register.
- UI-03 was uncommitted at report preparation. It has not been merged, pushed, or deployed.

## Delivered experience

The former engineering-oriented creation form is now a two-step guided flow:

1. **Definir contenido** — The only available format is the supported Instagram carousel. Users choose a dynamically loaded competition, an available source, season, phase, matchday, and supported language. The competition catalogue retains its existing identifiers and provider-neutral mappings. Unavailable options, loading and API failures are explained in context.
2. **Confirmar resultados** — A compact scope summary repeats the selected format and sports period. Users can select from currently available automatic, manual, or demonstration data modes using creator-friendly labels. Standings limitations are stated as informational, and a progressive disclosure keeps source details available without making provider terminology the default.

Manual JSON, CSV, and form import remain in the existing import workbench, linked from the confirmation step. The flow explains how to return and choose an available manual source after import. Existing validation, import versioning, source information, and integrity rules remain in place.

The final action, **Crear carrusel**, uses existing APIs in sequence: create the project, then start its full run. Duplicate submission is prevented. If creation fails, the user remains in the flow with an error. If saving succeeds but starting the run fails, the user is taken to the saved project with an explicit retry message; the UI does not report a successful generation.

The current catalogue API does not retrieve matches or scores before generation. The confirmation step clearly says those results have not yet been consulted and will be loaded when generation starts. It shows no fabricated scores, dates, or availability.

## Design decisions

- Kept the premium dark sports identity with purple surfaces, gold primary actions, Montserrat display headings, and Inter interface text.
- Used existing design tokens and scoped styles for the creation flow; no new component library or content format was added.
- Kept one clear primary action per step, real two-step progress, a backward action that preserves valid selections, and semantic radio/field controls.
- Preserved breadcrumbs and made a small shell spacing adjustment so they sit closer to the page heading.
- Used one-column content on mobile and retained the existing application shell and manual-import routes.

## Files changed

**Application:** `CreateProjectPage.tsx`, `CreateProjectPage.test.tsx`, `ProjectDetailPage.tsx`, `Projects.module.css`, `SelectionFields.tsx`, `copy.ts`, `AppShell.tsx`, `shellContext.ts`, `App.test.tsx`, `Layout.tsx`, `ListingProvenance.tsx`, and `Notice.module.css`.

**Browser tests and helpers:** `e2e/support/app.ts`, `e2e/tests/creation-visual.spec.ts` (new), `a11y.spec.ts`, `catalogue.spec.ts`, `dashboard.spec.ts`, `delivery.spec.ts`, `failure-restart.spec.ts`, and `manual-import.spec.ts`.

**Documentation:** `README.md`, `incremental-ux-ui-implementation-plan.md`, `tailwind-v4-migration-strategy.md`, `ux-ui-redesign-proposal.md`, `product-owner-decision-register.md`, and the UI-02 acceptance records (`ui-02-creator-dashboard-implementation-report.md`, `ui-02-dashboard-and-creation-entry-scope.md`).

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed, including Prettier check.
- `npm run test:unit` — 117 files, 2,158 tests passed.
- `npm run build` — passed for server, web, and contracts workspaces.
- `npm run test:e2e` — 17/17 passed, including creation and generation sequencing, manual import, recovery after run failure, and synthetic automatic-data, empty-catalogue, and API-error states.
- `npm run test:a11y` — 33/33 passed. This includes the creation route and responsive coverage at 1440, 768, and 390px.

No API contract, backend architecture, or dependency changes were made. Separate backend integration/contract suites and dependency audit were not run because the implementation changes are limited to the UI, its frontend tests, and browser test helpers; no backend or dependency files changed.

## Visual evidence

Saved under `evidence/UI-03/`, captured using the isolated E2E fixture and synthetic browser responses:

- [Step 1 desktop](evidence/UI-03/step-1-desktop.png)
- [Step 1 mobile (390px)](evidence/UI-03/step-1-mobile.png)
- [Step 2 desktop](evidence/UI-03/step-2-desktop.png)
- [Step 2 mobile (390px)](evidence/UI-03/step-2-mobile.png)
- [Automatic data option available](evidence/UI-03/automatic-data-available.png)
- [Manual import entry path](evidence/UI-03/manual-data-entry-path.png)
- [Empty catalogue](evidence/UI-03/empty-catalogue.png)
- [Catalogue API error](evidence/UI-03/catalogue-api-error.png)

Horizontal overflow was checked at 768px and 390px by the creation visual test. The shell responsive suite also exercised 1440px, 768px, and 390px.

## Known limitation

Sports matches and results are fetched only when the existing generation run starts. The pre-generation confirmation step therefore confirms selected scope and available catalogue capabilities rather than displaying match cards. Showing results earlier requires an existing backend capability or a separately approved API change.

## Preview and handoff

Run `npm run dev` from the repository root and open `http://127.0.0.1:5173/projects/new` (with the project's normal local API configuration). Review both steps, catalogue loading/error states, and the evidence above.

UI-03 has been accepted and closed on `work/WI-2.1-ui-03`. No UI-04 implementation has started.

## Acceptance and verification ownership

After this implementation's verification was completed, the Product Owner recorded PD-UI-21: Product Owner owns functional E2E testing and visual acceptance for UI-03 and later WI-2.1 tasks. The checks above document evidence gathered for this UI-03 implementation; future verification follows the targeted policy in the decision register and implementation plan. UI-03 visual acceptance is complete; UI-04A remains a separate, not-yet-started scope.
