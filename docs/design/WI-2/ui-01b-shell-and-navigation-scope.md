# UI-01B — Application Shell and Navigation Scope

Status: Implemented, verified, and accepted by Product Owner

## Objective

Apply the accepted UI-01A tokens and primitives to the shell, sidebar, header, primary navigation, project context, and responsive navigation. Use the approved hybrid Stitch direction from `docs/design/stitch_el_deporte_rey_studio.zip`: premium dark sports identity with clear task hierarchy.

## Recommended scope

- Compose the shell through `AppShell` and `Layout`, retaining route-level ownership of navigation and context.
- Desktop sidebar with Proyectos, Datos (existing import routes), secondary Marca y plantillas, and the primary **Crear contenido** action linking to `/projects/new`.
- Header with page title, project breadcrumb/context where available, and the current local-only notice.
- Keep existing routes, bookmarks, active-page semantics, and feature content available.
- Derive project context from existing route/project information; handle loading, missing project, and error states without inventing metadata or new API calls/contracts.
- Responsive navigation using the approved token breakpoints. Use a labelled disclosure on compact screens; if a modal drawer is chosen, implement Escape, focus containment, and focus return.
- Preserve skip navigation, landmarks, route focus management, keyboard order, focus visibility, reduced motion, reflow, and 44px targets.
- Keep theme and feature content styling boundaries explicit while legacy light CSS Modules remain in use.

## Acceptance evidence

- Capture representative list, creation, project, import, brand, and unknown-route baselines before changing the shell.
- Verify existing deep links and primary navigation, including project context after route changes.
- Test desktop, tablet, phone, keyboard navigation, 200% zoom, and reduced motion.
- Run typecheck, lint, relevant shell/component tests, production build, functional E2E, and accessibility checks.
- Review against the approved Stitch references and accepted UI-01A gallery.

## Boundaries

Feature-screen redesign, new formats, workflow changes, approval changes, backend changes, API changes, Next.js, and SaaS features remain outside UI-01B. Do not add prototype account/profile/PRO/notification controls or unsupported search. Publishing remains outside the application.

## Risks and dependencies

- Dark chrome around light legacy content needs deliberate surface boundaries; do not globally remap legacy colors or enable preflight.
- Dense sidebar/header content can obstruct mobile actions; validate reflow and long Spanish labels.
- Project context must tolerate absent or failed project data and must not disrupt existing route focus behavior.
- Official logo and KETSI assets remain pending; use the approved neutral placeholders and provisional brand tokens.
- Stitch contains unsupported features and external assets; adapt its visual hierarchy through existing React components and local tokens.
- UI-01A and UI-01B are accepted. The Product Owner requested closure and progression to the next increment; its scope is prepared separately for UI-02.

Implementation results and final route mappings are recorded in `ui-01b-shell-implementation-report.md`.
