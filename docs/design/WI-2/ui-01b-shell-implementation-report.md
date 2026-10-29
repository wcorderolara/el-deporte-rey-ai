# UI-01B — Application Shell and Navigation Implementation

Status: Accepted by Product Owner; implementation checkpoint closed
Branch: `work/WI-2.1-ui-01b`
Base: accepted UI-01A checkpoint `4c78b36` (implementation `a9f3923960946009c249bef5e0e8a6677508b1a3`)

## Delivered

`Layout` provides a reusable, router-independent frame with navigation, primary action, breadcrumbs, page title, project context, main content, and footer slots. `AppShell` composes those slots using the existing React Router location and navigation state. `shellContext.ts` derives presentation metadata from existing paths without fetching or duplicating project state.

The desktop shell uses a persistent 17rem sidebar at 1200px and wider. Below that threshold, tablet and mobile use a compact header and an in-flow navigation disclosure. The existing Button primitive controls the menu with `aria-expanded` and `aria-controls`. Escape closes it and returns focus; selecting a destination closes it and route navigation retains main-content focus. This is a disclosure, not a modal: content remains available and no focus trap is needed.

The header presents page hierarchy, breadcrumbs, and route-derived project context. The primary **Crear contenido** gold link opens the existing creation flow. Skip navigation, landmarks, active states, local-only notice, reduced motion, and native link behavior remain available.

## Existing destination mapping

| Navigation item | Destination | Behavior |
| --- | --- | --- |
| Inicio | `/` | Existing project list; no new dashboard. |
| Crear contenido | `/projects/new` | Existing project creation flow. |
| Mis proyectos | `/projects` | Existing project list alias. |
| Plantillas | `/brand#brand-templates-title` | Existing templates section; heading receives focus. |
| Mi marca | `/brand#brand-assets-title` | Existing asset section; heading receives focus. |
| Datos | `/imports` | Existing manual import/history/version functionality. |
| Configuración | No link | Explicitly labelled No disponible; no invented route. |

All original routes, deep links, feature headings, APIs, workflows, approval rules, backend behavior, and static formats remain unchanged.

## Styling and compatibility

- Reuses accepted UI-01A colors, typography, spacing, radii, shadows, touch sizes, focus, and breakpoints.
- Adds one layout token, `--spacing-shell-sidebar: 17rem`, for the shell width; the existing editor/sidebar token is preserved.
- Keeps the feature content on a bounded white surface with the legacy font and palette. Dark chrome does not remap legacy colors.
- Moves the existing default anchor color into the base cascade layer, allowing token-backed utility colors to work on shell links. Existing feature/module colors continue to take precedence.
- Preflight remains disabled. No packages or lockfile changes.
- Removes only the obsolete `AppShell.module.css` and `Layout.module.css`; feature CSS Modules are untouched.

## Stitch comparison

The ZIP contains creation, two editor, and download references plus the Kinetic Telemetry Studio description. The implementation adopts the dark layered sidebar/header, strong typographic hierarchy, gold primary action, and compact navigation identity. It adapts the references to Montserrat/Inter, approved provisional brand colors, rounded token shapes, the existing routes, and responsive disclosure.

The legacy white content workspace deliberately remains visible during incremental migration. Prototype profiles, PRO plans, notifications, search, remote imagery, generated logos, mascot substitutes, and unsupported tools were omitted. This increment does not reproduce the full editor or guided creation screens.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed, including formatting. |
| Frontend unit suite | 36 files, 492 tests passed. |
| `npm run test:unit` | 117 files, 2,152 tests passed. |
| `npm run build` | Server, web, contracts passed. |
| `npm run test:e2e` | 14 passed, including brand-section navigation/focus. |
| `npm run test:a11y` | 21 passed, including shell navigation at 1440/768/390px. Existing positive control still detects the seeded violation. |
| Responsive visual review | Desktop 1440px, tablet 768px, mobile 390px, menu open/closed. Final fixture-server captures show no global horizontal overflow on projects, creation, imports, brand, or unknown routes. |
| Zoom/reflow | 720px viewport equivalent to 200% of 1440px checked without global overflow; this is a reflow check, not a claim of full manual browser-zoom certification. |
| Keyboard and reduced motion | Browser tests cover Enter, Escape, trigger focus return, route focus, active state, and Axe with reduced motion enabled. |

Baseline: 18 pre-change screenshots (six routes at three widths) saved temporarily under `/tmp/edr-ui01b-before-*.png`. The initial Vite-only baseline included visible API-unavailable states because no development API was running. Final visual verification used a separate temporary fixture server on loopback with demo/manual data and stub AI, avoiding changes to operator projects or credentials. Fifteen final route captures and two open-menu captures are under `/tmp/edr-ui01b-final-*.png`; these are local review evidence, not committed assets.

The added same-page navigation regression test exposed a race where Router's internal location key closed a newly reopened menu. The shell now resets disclosure state only when the visible pathname/fragment changes. Selecting an already active destination closes the menu and returns trigger focus immediately.

No separate integration/contract suite or dependency audit was repeated: backend/contracts/dependencies are unchanged. UI-01A's two pre-existing moderate Satori/fflate audit findings remain recorded in its implementation report.

## Limitations and review dependencies

- Project context identifies the current project route and section; it does not duplicate project-name loading or claim a project exists before the feature validates it. Actual project data/errors remain in the feature screen.
- Inicio and Mis proyectos currently display the same existing project list through distinct preserved entry paths.
- Plantillas and Mi marca share the current brand page and target its existing headings.
- Configuración is unavailable. Official logo and KETSI assets remain pending; the shell uses text identity only.
- Advanced responsive redesign of dense legacy tables/forms belongs to later feature increments; their content may scroll within the legacy workspace.
- The Product Owner personally reviewed the result and confirmed it looks good without problems. UI-01B is accepted and its implementation is checkpointed on the feature branch. No merge, push, or deployment is authorized by this closure.

## Next increment

UI-02 follows the accepted shell: project browsing and the content-creation entry point. Its prepared scope is in `ui-02-dashboard-and-creation-entry-scope.md`. UI-02 application code has not started at this checkpoint.

## Preview

Run `npm run dev` from the repository root to start the existing API and Vite development workflow, then open `http://127.0.0.1:5173/`. If only `npm run dev:web` is running, the shell is visible but features require the configured local API on port 4300.
