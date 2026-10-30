# UI-05B — Export History and Project Workspace

**Status:** Accepted by Product Owner and committed  
**Branch:** `work/WI-2.1-ui-05b`  
**Base:** UI-05A `d9c3191a58cf17070ffbf5ebd6ff2517be7622cc`

## Delivered

- Added **Exportaciones** to the AppShell navigation with route-aware active state.
- Added a global export library that aggregates existing project and project-scoped export APIs. Results are sorted newest first, use existing safe slide-image URLs when available, and offer direct ZIP download and detail navigation. No global endpoint or API contract was added. Requests are bounded to four project histories at a time.
- Reworked global and project export histories into compact, text-first cards with title, date, image count, status, and separate download/content actions. Cards do not show slide images; previews remain in the project and export review workspaces.
- Extracted the responsive review workspace frame and thumbnail rail from `/review` into shared components. `/review`, project detail, and export detail now use the same desktop three-column layout and the same mobile stacking behavior.
- Project detail now loads the existing active draft and shows its actual carousel slides first, with keyboard-operable thumbnails, a large undistorted preview, current slide data/status, review/export actions, and direct download of the newest saved export when available. Run, language, selection, and technical options remain secondary.
- Export detail now uses the same shared workspace and thumbnails, with the exported image, available title/date/teams/score, caption disclosure, and repeat ZIP download. Creator-facing technical identifiers, hashes, paths, trace links, and slide descriptions are not shown; existing stored metadata and trace route remain.
- Download success feedback clears automatically after four seconds; actionable download errors remain visible.
- Simplified Dashboard cards to title, carousel format, status, and primary action. Project detail now foregrounds its content, status, and next action; export history remains a separate section. Selection, execution, language, verification, import, review, restart, and export routes remain available through progressive disclosure.
- Reduced breadcrumbs to a compact secondary row and applied semantic link tokens, underline, hover, and focus treatment. Demo data remains internally marked and constrained; the review/export/project views show at most one contextual safety notice rather than repeated banners and badges.
- Kept project-scoped history title/navigation visible during loading and retry/error states.
- Added targeted navigation, global history, compact card content, empty/retry/download and auto-dismiss feedback, carousel summary/navigation, export detail, and project workspace assertions.

## Files

Application shell/routes/context; history API, pages, copy, fixtures, renderer and tests; project detail and tests; this report, the incremental implementation plan, and Product Owner decision register.

## Verification

- `npm run typecheck` — passed.
- Targeted unit/component tests for project list/detail, project preview, export history/detail, and review workspace — passed (96 tests across 8 files).
- ESLint on affected source and test files — passed.
- `npm run build` — passed (server, web, and contracts workspaces).
- `git diff --check` — passed.
- Prettier applied to changed source, test, and report files.
- No E2E, browser, accessibility-suite, or visual-regression tests were run, per PD-UI-21. Manual acceptance remains with the Product Owner.

## API and limitations

No API contract or backend behavior changed. Global history is assembled from projects visible through the current project-list API and their scoped export histories; there is no independent global export-history endpoint. Thumbnail availability depends on existing slide artifacts and same-origin image access; the UI uses a labeled placeholder when no preview can be loaded. Existing export history remains project-scoped in its source data.

## Local preview

Run `npm run dev` from the repository root. Use the main **Exportaciones** navigation item for the global library, open a project and choose its export history, or open a project detail page to inspect the project workspace. Existing local API configuration and data are required for populated screens.

## Product Owner manual acceptance

1. Open **Exportaciones** from desktop and mobile navigation; confirm route and active state.
2. Confirm project/global export cards show title, status, image count, date, and the **Descargar**/**Ver contenido** actions without slide images.
3. Download an existing export from global history and project history; confirm it downloads without creating a new export.
4. Open an export detail and a project with generated content. Compare their thumbnail rail, main preview, and right-side panel with `/review`; select thumbnails and inspect available title, date, teams, and score.
5. Confirm project detail offers **Revisar contenido**, **Ver exportaciones**, and a direct download when a saved export is available; confirm execution/configuration sections remain collapsed.
6. Open an export detail, inspect caption disclosure and download action. Confirm technical identifiers, paths, hashes, and slide descriptions are absent from the creator-facing view.
7. Check Dashboard and export cards for broken word wrapping, repeated metadata, and oversized empty areas; verify the download success message disappears automatically.
8. Check empty and failed history states and retry; inspect keyboard focus, link contrast, responsive layouts, and absence of horizontal overflow at desktop, tablet, and mobile widths.

**No known contract or approval-rule changes.** Product Owner acceptance was received on 2026-10-30. UI-05B is committed on the current feature branch; it was not merged, pushed, or deployed.
