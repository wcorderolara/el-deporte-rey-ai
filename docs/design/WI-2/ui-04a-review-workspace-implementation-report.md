# UI-04A — Review workspace redesign

**Status:** Accepted by the Product Owner on 2026-10-29. Implementation is closed at the accepted local checkpoint; changes remain unmerged and unpublished.

## Baseline and branch

- Branch: `work/WI-2.1-ui-04`
- Accepted baseline: UI-03 commit `7b1daf1` (`feat(web): add guided UI-03 creation flow`)
- Working tree was clean at task start.
- No API contract, backend, dependency, carousel-rendering, or business-rule changes were made.

## What changed

The review page now has one primary title, `Revisión del contenido`, with functional, secondary breadcrumbs. The application-shell title and project-context line are hidden on this route to avoid repeating the page heading. The existing draft response does not include a project name, so the breadcrumb uses the existing generic `Proyecto` context; no request was added.

The page displays one selected carousel at a time. A compact slide rail uses the actual generated images, position, type, and approval state. Users can navigate by thumbnail, arrow keys, and previous/next controls. The selected image preserves its aspect ratio. Desktop and tablet use a multi-region workspace; mobile stacks the preview, slide rail, and actions.

The selected slide panel retains the existing approve, withdraw, regenerate, QA-warning acknowledgement, and final-approval behavior. Approval still targets the exact version ID. `Aprobar y siguiente` moves to the next slide after the existing approval call succeeds. Regeneration preserves the selected slide, refreshes review state, requires the new version to pass existing checks and receive new approval, and returns focus to its heading. Server errors and refusal details remain actionable.

Caption and hashtags appear in a separate readable, selectable copy section with independent approval and regeneration. Final approval remains a distinct server-gated action. The page shows slide approval counts and caption status; pending-item reasons are available in a disclosure.

Provenance, version and timestamp details, text-field verification labels, content flags, blocking-fact detail, and QA checks are grouped under the initially collapsed `Detalles y verificaciones` disclosure. Blocking reasons and unacknowledged QA warnings remain summarized beside the selected item. The draft summary, left-out matches, and exclusions editor remain available under `Datos y trazabilidad del borrador`.

## Components and files

**Review UI:** `ReviewPage.tsx`, `CarouselReview.tsx`, `ElementReview.tsx`, `copy.ts`, and `Review.module.css`.

**Shell refinement:** `AppShell.tsx`, `shellContext.ts`, and `Layout.tsx`.

**Tests:** `ReviewPage.test.tsx`, `ElementReview.test.tsx`, `FinalApproval.test.tsx`, and `App.test.tsx`.

**Documentation:** WI-2 plan, decision register, redesign proposal, Tailwind migration strategy, README, and this report.

## Technical verification

Results:

- `npm run typecheck` — passed.
- ESLint for affected TypeScript/TSX files — passed.
- Targeted unit/component tests — 5 files, 69 tests passed. Coverage includes review interactions, approval, regeneration, model, and shell.
- `npm run build` — passed.
- `git diff --check` — passed for the final working tree.

Playwright, browser-based accessibility, and visual regression suites were not run. Under Product Owner decision PD-UI-21, the Product Owner owns functional E2E testing and visual acceptance. No screenshots were generated for this increment.

## Known limitations

- The existing draft API has no project name. The review page therefore uses the generic project breadcrumb and does not issue a new request just to obtain a name.
- The carousel text remains read-only in UI-04A. Users can select and copy the caption using normal browser text selection; no new clipboard behavior or editing contract was added.
- Visual and functional browser acceptance remains to be performed by the Product Owner.

## Local preview

From the repository root, run `npm run dev`. Open `http://127.0.0.1:5173/projects/<project-id>/review` for a local project with an active draft.

## Product Owner manual acceptance checklist

1. Confirm the breadcrumb is usable and secondary, the page has one visible primary title, and the carousel position, slide count, and approval progress are clear.
2. Select each thumbnail, use previous/next, and use arrow keys while focused on a thumbnail. Confirm the selected image is the actual generated image, does not stretch, and the focus stays on the selected thumbnail during keyboard navigation.
3. On desktop and tablet, review the thumbnail rail, large preview, and action panel. On a 390px phone viewport, confirm preview, horizontal thumbnail rail, and actions stack without page-level horizontal overflow or covered actions.
4. Approve an eligible slide. Confirm the action is disabled while pending, the exact slide becomes approved, the next slide is selected when using `Aprobar y siguiente`, and other approvals remain intact.
5. Try an item with blocking data, a blocking visual-QA failure, an unacknowledged warning, and content flags. Confirm the approval remains blocked and the visible summary explains the next action.
6. Expand `Detalles y verificaciones`. Confirm provenance, verification status, version metadata, QA results, flag details, and warning acknowledgement are still available. Confirm blocking QA cannot be acknowledged away.
7. Regenerate a slide. Confirm the request uses the existing workflow, the selected slide remains selected, focus returns to its heading, and the new version needs its own QA and approval. Check that regeneration failures offer retry and do not change approval state.
8. Review the caption and hashtags as selectable text. Approve the copy independently and confirm its state does not substitute for slide or final approval.
9. Confirm the final summary counts approved slides accurately, shows copy status and pending reasons, and keeps final approval disabled until the server reports readiness. Confirm only a valid final approval exposes the existing export route.
10. Expand `Datos y trazabilidad del borrador` and confirm draft metadata, left-out matches, and the exclusions editor remain usable.

UI-04A was accepted on 2026-10-29 and closed on its dedicated branch. UI-04B bulk approval is a separate follow-on increment. Do not merge, push, or deploy without separate authorization.
