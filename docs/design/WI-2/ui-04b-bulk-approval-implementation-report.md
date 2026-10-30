# UI-04B — Bulk approval and review workflow optimization

**Status:** Accepted by the Product Owner on 2026-10-30. Implementation is closed at the accepted local checkpoint; changes remain unmerged and unpublished.

## Baseline

- Branch: `work/WI-2.1-ui-04b`
- Accepted UI-04A baseline: `f425297` (`feat(web): redesign carousel review workspace`)
- Working tree was clean at task start.
- No backend or API contract changes were needed.

## Changes

- Added **Aprobar todas** in the carousel workspace. The confirmation dialog reports total, eligible, already approved, warning, blocked, and pending QA counts. It excludes all slides that do not pass the existing client eligibility view and never acknowledges warnings.
- Approvals run sequentially through the existing `approveElement` API, carrying each current version ID. The server remains authoritative for publishability, flags, QA, version conflicts, and approval recording. Partial success is retained and reported by slide; retry first refreshes the draft and presents an updated confirmation.
- Kept **Aprobar diapositiva**, added the distinct **Aprobar y siguiente** action, and made next navigation find the next unapproved slide. Failed approval does not navigate; a changed selection is preserved while a request is pending.
- Kept caption approval and final carousel approval independent. The final action is labeled **Aprobar carrusel completo** and remains server-gated.
- Added keyboard focus management and Escape handling to the confirmation dialog, with responsive token-backed styling.

## Files changed

- `apps/web/src/features/review/CarouselReview.tsx`
- `apps/web/src/features/review/ElementReview.tsx`
- `apps/web/src/features/review/ElementReview.test.tsx`
- `apps/web/src/features/review/FinalApproval.test.tsx`
- `apps/web/src/features/review/Review.module.css`
- `apps/web/src/features/review/ReviewPage.test.tsx`
- `apps/web/src/features/review/copy.ts`
- `apps/web/src/features/review/model.ts`
- `apps/web/src/features/review/model.test.ts`
- `apps/web/src/features/review/useDraft.ts`
- WI-2 plan, decision register, README, design proposal, Tailwind migration strategy, and this report.

## Verification

- `npm run typecheck` — passed.
- ESLint for affected TypeScript files — passed after correcting one test lint finding.
- Targeted review tests — 4 files, 58 tests passed.
- `npm run build` — passed.
- `git diff --check` — passed on the final accepted changes.
- Playwright, browser accessibility, and visual regression suites were not run under PD-UI-21. No screenshots were generated.

## Manual Product Owner acceptance

1. Open a carousel with eligible, approved, QA-pending, warning, and blocked slides. Confirm the summary and dialog counts match the current versions.
2. Open **Aprobar todas**, cancel, and confirm no approval calls were made. Reopen it and verify the action approves only eligible slides after confirmation.
3. Confirm warning slides remain excluded until each warning is explicitly acknowledged through existing slide details. Confirm blocking errors remain unapprovable.
4. Simulate an API/network failure partway through bulk approval. Verify completed approvals remain, failed slides are identified, the draft refreshes, and retry shows a new accurate confirmation.
5. Trigger **Aprobar y siguiente** with approved slides between the selected slide and the next pending slide. Verify it skips approved slides and does not navigate on failure.
6. Change the selected thumbnail while approval is pending. Verify the request stays bound to the original slide/version and selection does not jump when it resolves.
7. Verify caption approval remains separate, progress updates, and bulk approval never invokes final carousel approval. Confirm **Aprobar carrusel completo** remains gated by existing server readiness.
8. Check keyboard-only dialog open, focus, Tab/Shift+Tab, Escape, loading, close, and focus restoration at desktop and mobile widths.

## Limitations

- Bulk approval is sequential, not atomic. This is deliberate: the current API offers only individual approvals, and each request already runs through the transactional domain service. Partial results are explicit and safely recoverable.
- Eligibility counts are a preflight from the latest loaded draft; each server approval revalidates the exact current version and may refuse if state changes after confirmation.
- Direct text/template editing and visual-template redesign remain outside UI-04B. The provided official brand asset archive was not opened or changed.
- Product Owner completed manual functional and visual acceptance on 2026-10-30.

Preview: run `npm run dev` and open `http://127.0.0.1:5173/projects/<project-id>/review` for a project with an active draft.

UI-04B was accepted on 2026-10-30 and is closed on `work/WI-2.1-ui-04b`. UI-05 has not started. Do not merge, push, or deploy without separate authorization.
