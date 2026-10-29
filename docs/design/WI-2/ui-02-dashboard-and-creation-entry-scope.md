# UI-02 — Dashboard and Content Creation Entry

Status: Next increment prepared following UI-01B acceptance; application code not started

## Outcome

A creator can start content creation or resume an existing project immediately from the accepted shell. Apply the hybrid Stitch direction and accepted tokens/primitives to project browsing and the entry point of the existing creation flow.

## Scope

- Replace the project list's table-only presentation with responsive project cards or a readable hybrid list.
- Show competition/period, format, current status, language/data-mode warnings, and existing history metadata where supplied by the current API.
- Provide one clear continuation action linking to the existing project route. Preserve all detailed metadata through secondary disclosure.
- Make **Crear contenido** the primary page action as well as the shell action.
- Improve loading, error/retry, empty, populated, long-title, and mobile browsing states using accepted primitives.
- Present only implemented formats as usable. The existing carousel remains the available creation format; do not add unsupported format selectors or new creation sequencing.
- Preserve all routes, source availability, demo warnings, verification/approval semantics, APIs, backend behavior, and local operation.

## Boundaries

Competition/data confirmation belongs to UI-03, the visual review workspace to UI-04, and download/import/history redesign to UI-05. No analytics dashboard, remote tracking, SaaS controls, providers, Next.js, new static formats, or backend/contract extensions.

## Verification and review

- Capture the accepted shell/project-list baseline before edits.
- Exercise empty/populated/error/retry states, long Spanish labels, and demo/manual project distinctions.
- Check project links and the primary action, keyboard/focus order, text contrast, 1440/768/390px reflow, and accessible status announcements.
- Run typecheck, lint, relevant component tests, build, functional E2E, and accessibility gates.
- Keep the slice reviewable and stop for Product Owner visual acceptance before UI-03.

## Dependencies

Use only metadata and status semantics available through existing typed contracts. Do not infer timestamps, completion percentages, or approval readiness from unsupported assumptions. Official brand assets remain pending; use the accepted text identity and provisional tokens.
