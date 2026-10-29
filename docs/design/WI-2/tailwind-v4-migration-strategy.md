# WI-2.1 — Tailwind CSS v4 Migration Strategy

Status: UI-01A foundation accepted by Product Owner; feature and shell migration not authorized
Date: 2026-10-29
Applies to: UI-01 through UI-06 on the existing React/Vite frontend

Implementation checkpoint (UI-01A): M0 and the token/global portion of M1 are complete; the initial primitive subset of M2 is complete. Preflight remains intentionally disabled during coexistence. M3 application shell and all M4 feature slices have not started.

## 1. Decision and objective

Tailwind CSS v4 is the target styling foundation for the WI-2.1 redesign. The migration must improve consistency and delivery speed without destabilizing the functional WI-1 application.

The migration is incremental:

- React, React Router, Vite, TypeScript, and the current API architecture remain.
- Tailwind and CSS Modules coexist while features are migrated.
- Existing CSS Modules are not bulk-converted or deleted.
- New and materially redesigned shared components use Tailwind utilities backed by approved design tokens.
- A legacy CSS Module is removed only when its complete owning surface has passed visual, responsive, behavioral, and accessibility verification.

## 2. Design-token architecture

Design Tokens are the source of truth, not individual Tailwind class choices or legacy module values.

Token groups:

- Brand: deep purple, dark purple, gold, electric blue, white, and dark neutral surfaces.
- Semantic: success, warning, error, information, focus, verified, unverified, operator-attested, and demonstration.
- Content surfaces: canvas, elevated panel, muted panel, border, overlay, and editor workspace.
- Typography: Montserrat display roles; Inter interface/body/numeric roles; sizes, weights, line heights, and tracking.
- Spacing: consistent 4px-derived scale.
- Shape: control, card, panel, and overlay radii.
- Elevation: restrained studio surface/overlay levels.
- Layout: content widths, gutters, header/editor dimensions, and responsive breakpoints.
- Motion: durations/easing with reduced-motion behavior.

Rules:

1. Expose runtime theme values through CSS custom properties so existing CSS Modules, Tailwind utilities, rendered previews, and future official brand values can interoperate.
2. Map Tailwind theme utilities to the same approved tokens rather than maintaining a second palette/spacing system.
3. Keep semantic state tokens separate from brand colors. Purple/gold styling must not redefine verified, warning, error, demo, or attested meaning.
4. Do not introduce raw hex colors, arbitrary spacing, or one-off typography when a token exists. Exceptions require a documented design reason.
5. Official brand values may replace provisional token values without changing component contracts.

## 3. Coexistence boundaries

During migration:

- Keep `global.css` responsible for the minimum application baseline that must work for every route, including box sizing, body defaults, focus visibility, reduced motion, and locally loaded fonts until those responsibilities are deliberately moved.
- Keep existing `*.module.css` imports on untouched legacy components.
- Use Tailwind on new shared primitives and on a component only when that component is explicitly in the current migration slice.
- Avoid styling the same property on the same element from both a CSS Module and Tailwind. Use a clear component/wrapper boundary when systems coexist.
- Do not hide specificity conflicts with escalating `!important` usage. Resolve the ownership boundary.
- Do not mechanically translate every legacy declaration into a utility. First normalize it to a token and shared primitive where appropriate.
- Keep complete, statically discoverable class names in component variants; do not construct unpredictable utility names from API or user data.
- Do not add a class-composition dependency by default. Existing TypeScript helpers and explicit variant maps are sufficient unless a later task justifies otherwise.

## 4. Migration sequence

### M0 — Baseline and dependency gate

After explicit UI-01 implementation approval:

- Record current responsive screenshots and accessibility/interaction baselines for representative routes.
- Select the supported Tailwind v4 integration for the existing Vite build.
- Pin exact package versions, update the lockfile, and run the repository’s dependency/security checks.
- Confirm production CSS generation and local static serving remain compatible.
- Audit the framework’s baseline/reset effects against native controls, tables, images, headings, dialogs/disclosures, and the existing focus/reduced-motion rules before broad rollout.

### M1 — Tokens and global foundation

- Define provisional brand and semantic tokens.
- Load Montserrat/Inter from authorized local assets.
- Map Tailwind utilities to the token system.
- Establish responsive/container conventions.
- Preserve the current accessible global baseline.

### M2 — Shared primitives

Migrate or create the UI-01 primitives first:

- Button and ButtonLink.
- Field controls and error summary.
- Alert/Notice and status badges.
- Card/Panel/Disclosure/Tabs.
- Page header, breadcrumbs, project progress, loading/error/empty states.
- Responsive table wrapper.

Shared primitives own visual variants; feature components continue to own domain behavior.

### M3 — Application shell

- Implement the hybrid premium-dark/clear-UX shell.
- Preserve skip navigation, landmarks, current-page state, route focus management, local-only messaging, and responsive navigation.
- Verify all untouched feature pages remain readable inside the new shell.

### M4 — Vertical feature slices

Recommended order aligned with the approved UI phases:

1. Projects dashboard and Crear contenido entry.
2. Competition/data confirmation.
3. Review/editor workspace.
4. Download/history.
5. Manual-data management.
6. Brand/templates and deep audit screens.

For each slice:

1. Identify duplicated patterns to replace with shared primitives.
2. Migrate the smallest complete component boundary.
3. Verify all states before deleting legacy selectors.
4. Remove only the now-unused CSS Module rules/imports.
5. Record any intentionally retained feature-specific CSS.

### M5 — CSS Modules retirement audit

At the end of UI-06:

- List remaining modules and the reason each remains.
- Remove orphaned modules and selectors only after usage checks.
- Confirm no application-wide requirement depends on accidental legacy cascade/specificity.
- CSS Modules may remain for genuinely specialized styles where Tailwind would reduce clarity; complete elimination is not an acceptance criterion.

## 5. Definition of done per migrated component

A component is migrated only when:

- Every current state and responsive layout is represented.
- Domain behavior and API calls are unchanged.
- Keyboard order, focus visibility, accessible names, live status, and reduced motion remain correct.
- Text/status meaning does not depend on color alone.
- 200% zoom/reflow and required touch targets pass.
- No unresolved Tailwind/CSS Module specificity conflict remains.
- Relevant unit/E2E/a11y checks pass.
- Visual comparison is approved against the hybrid Stitch direction.
- Unused legacy rules/imports for that component are removed.

## 6. Rollback and risk control

- Keep migrations reviewable by component or feature; do not combine unrelated screens.
- Do not delete the legacy module before the replacement passes review.
- If baseline/reset behavior causes regressions, limit rollout and resolve the global strategy before migrating more features.
- If the generated stylesheet materially harms load/render behavior, measure and correct it before continuing.
- Preserve semantic HTML; utility classes must not drive markup into inaccessible generic containers.
- Tailwind adoption does not authorize changes to API contracts, backend behavior, routes, data modes, verification, approvals, export history, or security controls.

## 7. Next.js boundary

This migration must not assume Next.js conventions, file-system routing, server components, server actions, hosted deployment, or SSR. Tailwind is adopted for the current Vite SPA.

A future Next.js assessment may reuse the token model and component design, but it must be a separate architecture proposal with measurable benefits and migration costs. Tailwind adoption is not a prerequisite or justification for a framework migration.

The token model must also keep semantic application states distinct from brand configuration. That separation supports official El Deporte Rey asset replacement now and possible tenant-aware branding later without implementing tenant theming in WI-2. Shared styled primitives should remain independent of route objects so the styling migration does not increase framework coupling.
