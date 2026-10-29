# WI-2.1 — Current Screen Inventory and Journey Map

Status: UX/UI discovery deliverable
Date: 2026-10-29
Scope: `apps/web` on commit `c60fec9` (`main`)

## 1. Frontend inventory

### Technology and application structure

| Concern | Current implementation | Assessment |
| --- | --- | --- |
| Framework | React 19.3 with TypeScript | Appropriate; no replacement is justified. |
| Build tool | Vite 8.3 | Appropriate for this local single-page application. |
| Routing | React Router 8.4, browser history, lazy-loaded feature roots, nested feature routes | Sound technical structure. User-facing route relationships are less clear than the code structure. |
| UI library | None. Native HTML, CSS Modules, and a small shared `src/ui` layer | Keeps the dependency surface small, but common controls and layout patterns are duplicated. |
| State management | Local React state, feature dependency contexts, and custom request/polling hooks | Suitable for the current scope. There is no Redux/Zustand/TanStack Query-style store. Server state behavior is repeated across features. |
| API client | Same-origin typed client under `/api/v1`, with contract validation | Must remain unchanged. |
| Styling | One global token file plus feature-local CSS Modules | Accessible foundations, but the global tokens are too limited to act as a design system. |
| Test coverage | Component tests, end-to-end journeys, and axe scans for serious/critical issues | A strong baseline to preserve and extend with responsive and interaction tests. |

Feature boundaries are clear: `projects`, `facts`, `review`, `history`, `imports`, and `brand`. Shared primitives currently cover the application shell, errors, notices, availability, references, and status/provenance badges. Most buttons, forms, cards, tables, definition lists, visually-hidden helpers, and spacing rules are still feature-specific.

### Route and screen inventory

| Route | Current screen | Purpose | Main actions | Primary concern |
| --- | --- | --- | --- | --- |
| `/` and `/projects` | Project list/home | Shows every project and its competition, source, mode, language, approval state, and latest export | Open project; create project | An eight-column operational table is the first experience; it does not prioritize “continue where I left off.” |
| `/projects/new` | New project | Selects competition, source, season, stage/matchday, and content language | Create project | Long, technical, progressively revealed form; catalogue/source diagnostics precede the creator’s goal. |
| `/projects/:projectId` | Project detail/run control | Shows project metadata, links to downstream sections, language controls, and workflow-run status | Start/restart full run; redraft; open facts/review/exports/imports | Functions as an orchestration console instead of a creator workspace. “Create project” and “start execution” are separate concepts/actions. |
| `/projects/:projectId/runs/:runId/facts` | Facts and verification | Shows facts grouped by match/standings/context/team, evidence, disputes, and manual approval | Refresh; manually approve/revoke eligible facts; open review/project | Essential trust information is presented at maximum detail by default. Terminology and density suit an auditor more than a content creator. |
| `/projects/:projectId/review` | Review and approval | Shows draft summary, every carousel element, images, text/provenance, flags, QA, exclusions, element approval, and final approval | Approve/withdraw/regenerate each element; acknowledge warnings; edit exclusions; final approve | A long single-column page makes slide-to-slide comparison, issue triage, and progress tracking difficult. |
| `/projects/:projectId/exports` | Export and project export history | Shows export eligibility, export action, project summary, and export records | Export approved carousel; open export; go to review/project | Export is separated from review, and the user must infer readiness across screens. |
| `/projects/:projectId/exports/:exportId` | Export detail | Reopens exact exported content and lists output directory/files | Inspect slides/caption; open slide trace | Audit identifiers and file details dominate; useful after export but not optimized for routine retrieval. |
| `/projects/:projectId/exports/:exportId/slides/:position/trace` | Slide trace | Shows every fact and evidence item used by an exported slide | Inspect facts/evidence/disputes | Correct specialist view; should remain a deep audit view rather than a primary-flow destination. |
| `/imports` | Manual import workbench | Imports JSON/CSV or form data, shows last result, history, and versions | Upload file; enter data; retry; download original; inspect import/version | Several separate jobs share one very long page. The form path requires raw identifiers and substantial domain knowledge. |
| `/imports/:importId` | Import detail | Shows one applied import, its original, selections, and versions | Download original; open versions | Clear audit purpose, but hierarchy and contextual navigation are minimal. |
| `/imports/versions/:versionId` | Manual-data version detail | Shows metadata, teams, matches, and standings for one stored version | Inspect data; return to imports | Dense tables and internal IDs are exposed without a summary-first layer. |
| `/brand` | Brand and templates | Registers/activates assets and previews versioned templates | Register asset; activate/deactivate; switch preview language | Asset management and template inspection compete on one page; current application chrome does not use the configured brand identity. |
| `*` | Not found / route error / loading | Handles invalid routes and failures | Return to projects; retry where available | Semantic and accessible, but visually generic. |

## 2. Current navigation model

The global navigation has only three destinations:

- Projects
- Manual imports
- Brand and templates

Facts, review, exports, export detail, and trace are reachable only through project-local text links and backlinks. There is no breadcrumb, project-level tab bar, creation stepper, persistent progress indicator, or cross-screen summary of what the user should do next.

The navigation reflects implementation domains rather than the user’s two main modes:

1. Create and deliver content.
2. Configure reusable data and brand resources.

## 3. Current primary journey

```text
Project list
  -> New project
     -> inspect catalogue source diagnostics
     -> select competition
     -> confirm/select source
     -> select season
     -> select stage
     -> select matchday or whole stage
     -> select language
     -> Create project
        -> Project detail
           -> Start full execution
              -> wait/poll through research, verification, content,
                 rendering, and visual QA
              -> optionally open Facts and verification
              -> open Review and approval
                 -> inspect each element
                 -> acknowledge QA warnings where needed
                 -> approve each slide and caption individually
                 -> give final approval
                    -> open Exports and history
                       -> export the carousel
                       -> open export detail
                       -> optionally inspect files and slide trace
```

The underlying sequence is valid, but it is fragmented across six route types and uses system terminology at every transition. The creator has to translate “project,” “execution,” “facts,” “element version,” and “final approval” into the intended outcome: a safe, publishable carousel.

## 4. Current manual-data journey

```text
Manual imports
  -> choose File or Form
  -> provide/import data
  -> resolve validation errors
  -> inspect applied version
  -> return to Projects
  -> New project
  -> locate imported competition
  -> create project
  -> start full execution
  -> open Facts
  -> manually approve each eligible fact when policy allows
  -> open Review
  -> continue only if publication policy allows the attested data
```

This preserves important safety semantics, but the connection between importing data and creating content from that data is weak. The successful import result hints at the next step instead of offering a direct, contextual continuation.

## 5. Current brand-management journey

```text
Brand and templates
  -> register logo, mascot, or decoration
  -> activate/deactivate assets
  -> preview all code-versioned templates in Spanish or English
  -> return to Projects
  -> regenerate or create later content to see changes
```

There is no immediate “preview with this brand setup” workflow beyond template samples, and no clear separation between global configuration and per-project creation.

## 6. Existing strengths to retain

- Spanish-first copy with explicit, careful wording around verified, unverified, manually approved, and demonstration data.
- Semantic landmarks, heading structure, labels, fieldsets, status regions, focus movement, skip navigation, and visible focus treatment.
- Statuses use text and symbols rather than color alone.
- Error messages are mapped from closed codes and usually provide retry behavior.
- Demo content and operator-attested content are deliberately distinguished.
- Exact versions, provenance, evidence, disputes, QA checks, and export traceability are available.
- Native controls and dependency-light React architecture reduce implementation and accessibility risk.
- Tables are generally wrapped for horizontal overflow; forms use fluid grids in several areas.
- Automated axe coverage includes all major screens and important blocked/error states.

## 7. Evidence and audit limitations

This audit is based on the complete frontend source, route definitions, styles, copy, component tests, end-to-end journeys, accessibility tests, brand configuration, and repository history. A live visual walkthrough was not run because `node_modules` is absent and this work item explicitly prohibits installing dependencies. Visual conclusions are therefore code-evidenced rather than screenshot-evidenced. A responsive browser review at 320, 375, 768, 1024, and 1440 CSS pixels is required at the start of implementation.

## 8. Refined target mapping after Product Owner decisions

The current inventory above remains the baseline. PD-UI-01 through PD-UI-13 refine its target presentation as follows without removing any WI-1 capability:

| Current screen/route | Refined creator-facing role | Preserved secondary/technical capability |
| --- | --- | --- |
| `/`, `/projects` | **Proyectos** dashboard with **Crear contenido**, Continue actions, format/status previews, and creator-oriented cards/list | Full chronological history, data mode, language, approval state, last export. |
| `/projects/new` | Stages 1–2: **Definir contenido** and **Confirmar datos**; format, sports selection, language, automatic/manual/demo data | Source availability, exact season/stage/matchday semantics, catalogue provenance, retrieval details. |
| `/projects/:projectId` | Saved **Proyecto** workspace and Stage 3 **Generar contenido** with plain-language progress, completion previews, and **Revisar contenido** | Full/redraft behavior, polling, stage table, failure codes, source diagnostics under technical details. |
| Facts route | Secondary **Detalles de verificación** from the data-readiness summary | Every fact, evidence record, dispute, reason, manual approval, reference, import version, and left-out match. |
| Review route | Stage 4 three-panel visual editor; carousel rail, large preview, inspector, **Aprobar y siguiente**, final approval | Provenance, QA, warnings, flags, versions, blocking facts, regeneration, withdrawal, exclusions, invalidation. |
| Exports route | Stage 5 **Descargar** with one **Descargar contenido** action, package summary, and local history | Existing export API, eligibility, directories, files, hashes, manifests, immutable records. |
| Export detail/trace | Secondary immutable download record and “Why is this on the asset?” trace | Exact versions, facts, sources, data modes, approvals, disputes, and identifiers. |
| `/imports` | Dedicated top-level **Datos** area with Importar, Historial, and Versiones; also reachable contextually during creation | JSON/CSV/form channels, whole-import validation, every error, originals, hashes, versions, source metadata. |
| Import/version detail | Data record with summary-first hierarchy and technical details | All stored selection/version/team/match/standings data. |
| `/brand` | Separate Recursos de marca and Plantillas views using the approved provisional visual direction | Authorization restrictions, activation, versioned templates, language preview, empty badge slots. |
| Global errors/loading/not found | Consistent branded async/error/empty states with recovery | Existing safe error mapping, retries, route boundaries, focus and live announcements. |

The final primary journey ends at download. No screen gains social-account connection, publication, scheduling, analytics, or video controls. Additional static formats are not assumed to exist; they become visible as usable choices only after their separate format work items are implemented.

## 9. Approved frontend target for the redesign

The current-state inventory remains accurate: the application presently uses React/Vite/React Router with global CSS and feature CSS Modules. The approved WI-2.1 target is:

- Retain React, React Router, Vite, TypeScript, routes, typed API client, and current state-management approach.
- Implement the hybrid Stitch direction: Option A premium dark sports identity plus Option B clear/intuitive UX.
- Add Tailwind CSS v4 and a token-driven design system in UI-01 after implementation approval.
- Migrate CSS Modules incrementally by component/feature; Tailwind and modules coexist during the transition.
- Keep Next.js outside WI-2.1 as a future architecture consideration.
- Preserve reasonable future SaaS portability at changed boundaries without adding users, tenants, authentication, cloud persistence, or other SaaS behavior during WI-2.

This target does not alter any current screen purpose, API contract, backend rule, security control, or approval behavior.

