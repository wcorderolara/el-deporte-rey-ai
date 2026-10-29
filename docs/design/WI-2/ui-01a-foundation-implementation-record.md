# UI-01A — Tailwind CSS v4 and Design Tokens Foundation

Status: Accepted by Product Owner after personal review of the local gallery
Date: 2026-10-29
Branch: `work/WI-2.1-ui-01a`
Starting commit: `2270ebe`

Acceptance checkpoint: the Product Owner approved the visual result and accepted UI-01A in the current conversation. Committing this increment on its current feature branch is authorized. UI-01B is prepared for review only; implementation requires a separate approval.

Checkpoint validation: root typecheck, lint/formatting, all 9 primitive tests, production build, and `git diff --check` were rerun successfully before committing. The full unit, functional E2E, accessibility, and audit results below are retained from UI-01A implementation verification; those broader checks were not rerun for this documentation-only acceptance update. No unrelated working-tree changes were found.

## 1. Scope delivered

UI-01A establishes the styling foundation without redesigning the application shell or any feature screen:

- Tailwind CSS v4 integrated through the official Vite plugin.
- Centralized CSS/Tailwind Design Tokens.
- Authorized local Montserrat and Inter font files.
- Controlled compatibility aliases for existing CSS Modules.
- Explicit Tailwind preflight decision.
- Button, IconButton, Card, Badge, Input, Select, Textarea, Alert, EmptyState, and LoadingState primitives.
- Component tests and an isolated design-system review gallery.

No route, application shell, feature workflow, API contract, backend behavior, persistence, provider, approval rule, or security boundary changed. UI-01B has not started.

## 2. Baseline captured before integration

The implementation began from a clean working tree on `work/WI-2.1` at `2270ebe`, then moved to the dedicated implementation branch.

The baseline was captured structurally and through a production build:

- React 19.3.0, React Router 8.4.0, Vite 8.3.4, TypeScript 6.0.3.
- No UI library and no Tailwind dependency.
- One minimal `global.css`, 11 CSS Module files, and the existing shared `src/ui` layer.
- Existing global behavior: border-box sizing, zero body margin, visible 3px focus outline, inherited button font, and reduced-motion override.
- Legacy interface palette was light and exposed through 11 `--edr-*` variables.
- CSS Modules contained 28 lines with direct hex values in addition to legacy variables; those feature modules were intentionally not migrated.
- No responsive breakpoints existed in the global foundation.
- Pre-integration web production build passed; its main CSS asset was 4.54 kB (1.49 kB gzip).

There was no committed pre-change visual screenshot baseline. UI-01A therefore preserves the measurable source/build baseline and existing behavior tests; targeted visual baselines should be committed only when the relevant screen enters its approved migration slice.

## 3. Stitch reference assessment

The archive contains four static screen references plus the Kinetic Telemetry Studio design description. UI-01A uses them as visual input, not source code.

### Adopted

- Obsidian canvas and layered dark studio surfaces.
- Strong white/soft-neutral text hierarchy.
- Gold reserved for prominent actions and selected states.
- Blue for interactive/focus/information emphasis.
- Compact high-signal labels and restrained technical borders.
- 4px-derived spacing and desktop/tablet/mobile layout thresholds.

### Adapted

- Montserrat and Inter from the approved Product Owner direction replace Stitch's external Anybody and Space Grotesk fonts.
- Approved provisional brand values (`#5B2A86`, `#2E1145`, `#D4AF37`, `#1F4FB8`) replace Stitch's alternative brand values.
- Approved 6/10/16px control/card/panel radii replace the prototype's absolute zero-radius rule.
- Product language remains **Crear contenido** and **Descargar contenido**, not publication or social-upload language.
- Semantic success, warning, danger, verified, unverified, attested, and demo colors remain independent of brand styling.

### Rejected or deferred

- Stitch HTML, Tailwind CDN configuration, inline scripts, external fonts, remote images, and Material icon dependencies.
- Invented logo or KETSI representation.
- Account/profile, PRO plan, notification, tenant, publishing, scheduling, or upload controls.
- Unsupported providers, format activation, direct canvas editing, and direct saved-copy editing.
- Shell/sidebar and feature-screen layouts, which belong to UI-01B and later approved phases.

## 4. Tailwind integration

Pinned development dependencies:

- `tailwindcss@4.3.3`
- `@tailwindcss/vite@4.3.3`

`vite.config.ts` registers the official Vite plugin without changing root, host, proxy, environment, or build security options. No JavaScript Tailwind config file is required; the theme is CSS-first.

`global.css` imports:

1. `tailwindcss/theme.css` in the theme layer.
2. Local `tokens.css`.
3. `tailwindcss/utilities.css` in the utilities layer.

Source detection is limited explicitly to the web `src` tree.

## 5. Token architecture

`tokens.css` is the source of truth for:

- Brand, studio-surface, text, border, and semantic colors.
- Montserrat display and Inter interface/body font families.
- Role-based font sizes, line heights, weights, and tracking.
- 4px spacing plus touch target, gutter, reading, content, sidebar, and inspector dimensions.
- Control, card, panel, and pill radii.
- Hairline, strong, spinner, and alert border widths.
- Control, card, overlay, focus, and gold-glow shadows.
- Focus-ring width, offset, and color behavior.
- 600/900/1200/1440px responsive breakpoints.
- Fast/standard/slow motion durations and easing.

Tailwind utilities and runtime CSS custom properties resolve to the same values. New primitives contain no duplicated raw colors. Existing `--edr-*` variables now alias a centralized compatibility palette so legacy CSS Modules retain their current light appearance until their owning feature is migrated.

## 6. Preflight and CSS compatibility decision

Tailwind preflight is intentionally not imported in UI-01A. Its global margin, padding, border, heading, list, image, table, button, input, select, and textarea normalization would change every untouched feature screen.

Instead:

- The existing accessible global baseline remains authoritative.
- Tailwind theme variables and utilities are active.
- New primitives fully declare their own spacing, borders, surfaces, type, disabled behavior, and minimum targets.
- Legacy CSS Modules remain unchanged.
- A new component must not combine CSS Module and Tailwind ownership for the same property on the same element.
- Preflight can be reconsidered only after a separately reviewed baseline strategy covers all remaining legacy routes.

The compiled CSS was inspected and contains no Tailwind preflight margin/padding/border reset.

## 7. Primitive contracts

| Primitive | Accessibility and portability behavior |
| --- | --- |
| Button | Native button, default `type="button"`, four visual variants, three sizes, disabled/loading protection, `aria-busy`. |
| IconButton | Mandatory accessible label and 44×44 minimum target; decorative child hidden from assistive technology. |
| Card | Route/domain-neutral structural surface with selectable `div`, `article`, or `section` semantics. |
| Badge | Visible text always carries status meaning; semantic tones include distinct attested and demo treatments. |
| Input | Native labelled control with connected guidance/error IDs, required and invalid semantics. |
| Select | Native select behavior with the same labelled field structure. |
| Textarea | Native resizable multiline control with the same labelled field structure. |
| Alert | Callers select `note`, `status`, or `alert` according to announcement timing; tone does not determine semantics implicitly. |
| EmptyState | Explicit heading-level contract, description, optional decorative icon, and optional action. |
| LoadingState | Polite live status; spinner obeys the global reduced-motion rule. |

All primitives are independent of React Router, API clients, AI providers, persistence, domain rules, brand records, and feature state.

## 8. Review gallery

The isolated gallery is a Vite development entry, not an application route and not part of the production server entry. It displays all primitive families and key states against the approved dark studio foundation.

Preview:

```bash
npm run dev:web
```

Then open `http://127.0.0.1:5173/design-system.html`.

The gallery was visually reviewed at 1440×1200 and 390×844. It reflows without horizontal dependency, and Axe reported zero violations across the configured WCAG A/AA tags.

## 9. Build and performance observation

The post-integration main CSS asset is approximately 22.36 kB (5.23 kB gzip). The three existing authorized TTF files are emitted as local build assets, approximately 1.03 MB uncompressed in total. A later performance phase may evaluate WOFF2/subsetting under the existing font licensing and security controls; UI-01A does not add a converter or remote font service.

## 10. Migration boundary

The next increment must not start without Product Owner approval. UI-01B would apply these foundations to the application shell and navigation. Feature-specific screens and their CSS Modules remain owned by UI-02 through UI-06.

## 11. Verification evidence

| Check | Result |
| --- | --- |
| Root TypeScript typecheck | Passed. |
| ESLint and Prettier check | Passed with zero warnings. |
| Primitive component tests | 9 passed. |
| Full unit suite | 117 files and 2,149 tests passed. The first sandboxed attempt could not bind four loopback test servers; the authorized rerun passed completely. |
| Production build | Passed for server, web, and contracts. |
| Functional E2E | 13 passed in Chromium. |
| Application accessibility E2E | 18 scenarios completed successfully with no serious/critical Axe violations; the positive control continued to detect its seeded problem. |
| Isolated gallery Axe scan | 0 total violations for the configured WCAG A/AA tags. |
| Visual review | Passed at 1440×1200 and 390×844; no horizontal dependency or broken primitive layout observed. |
| Compiled CSS inspection | Tailwind tokens/utilities present; preflight reset absent. |
| Dependency audit | No high or critical findings. Two moderate findings remain in the pre-existing `satori → fflate@0.7.3` chain; `npm audit fix --force` would introduce a breaking Satori change and was not applied. Tailwind introduced no reported finding. |

Separate integration and contract suites were not executed because UI-01A changes no backend or API contract. The full functional E2E suite was executed to verify existing application behavior through the changed Vite/CSS pipeline.
