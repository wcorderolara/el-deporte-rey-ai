# WI-2.1 — Open Design Dependencies and Questions

Status: Open inputs after PD-UI-01 through PD-UI-20
Date: 2026-10-29

## 1. Required before or during the initial redesign

| Dependency | Owner | Needed by | Current fallback |
| --- | --- | --- | --- |
| Exact hybrid Google Stitch frames/link/export for implementation comparison | Product Owner/design | Before high-fidelity UI-01 review if pixel-level comparison is expected | Direction is already approved: Option A identity + Option B usability. Proceed from the documented direction; never adopt generated code as architecture. |
| Official El Deporte Rey logo files and usage rules | Product Owner/brand | Before final shell/brand polish | Text wordmark or neutral reserved logo slot; no invented logo. |
| Official color values and typography confirmation | Product Owner/brand | Before final token sign-off | Approved provisional palette and bundled Montserrat/Inter. |
| Official KETSI assets and usage rules | Product Owner/brand | Before mascot placement | Empty/reserved mascot slots; no invented or redesigned KETSI. |
| Representative creator availability for usability validation | Product Owner | Before UI-02/UI-03 sign-off | Internal heuristic review is insufficient for final workflow validation. |
| Supported text-edit persistence behavior | Product/architecture | Before UI-04 interactive editor sign-off | Present existing text for review/regeneration only; do not show a false editable-save experience. |
| Per-asset template and brand-style persistence | Product/architecture | Before UI-04B | Show current template/brand information; keep existing global active assets and code-versioned templates unchanged. |

## 2. Google Stitch evaluation checklist

When a Stitch design is selected, record a design comparison rather than copying its code. Confirm:

1. It supports the five stages and **Crear contenido** terminology.
2. It ends with **Descargar contenido** and contains no publish/schedule/account controls.
3. It supports the current React Router route/context model or can be mapped without breaking links.
4. It can consume the current API responses without hiding required states.
5. It preserves LIVE/MANUAL/DEMO distinctions, verification blockers, QA, approval, invalidation, history, and trace.
6. It supports carousel ordering and per-slide/caption/final approval.
7. It adapts to single-image formats without fake carousel controls.
8. Desktop uses the three-panel editor appropriately; tablet/mobile degrade according to PD-UI-10.
9. DOM/focus order, landmarks, headings, forms, keyboard operation, live status, contrast, target size, reflow, and reduced motion can meet WCAG 2.2 AA.
10. Brand visuals can be expressed through local tokens/assets without a new dependency or remote asset requirement.
11. Generated component/code assumptions do not replace the current architecture, API client, typed contracts, security boundaries, or tests.
12. Unsupported concept elements are explicitly omitted or deferred.

The evaluation outcome should classify each visible concept as: adopt, adapt, defer, or reject, with a reason.

The direction-selection question is closed by PD-UI-14. This checklist evaluates fidelity and compatibility of the concrete reference; it does not reopen the hybrid decision.

## 3. Questions for future static-format work items

These do not block UI-01 through UI-06 because the initial redesign remains carousel-only:

1. Should a single-image creative require the same separate final approval after its asset/text approval? Current recommendation: yes for consistent safety, pending a recorded Product Owner decision.
2. Which first single-image templates are required for SF-01: match result, standings snapshot, headline, cover, or all?
3. Which copy variations are needed for each format, and what length guidance applies? This concerns text only, not platform integration.
4. What safe-zone rules are approved for Story and Reel/TikTok covers?
5. Should a 9:16 Story and a 9:16 Reel cover share base templates with distinct semantic variants, or have separate template families?
6. What should a single-image download package contain and how should files be named?
7. Should text-only projects be independent saved projects or text variants attached to a graphic project?
8. Which new format follows portrait post: square post, Story, Reel cover, or standalone text? Creator research should inform the order after SF-01.

## 4. Questions for the later direct-edit capability

These do not block the current-contract review workspace (UI-04A):

1. Which fields may the creator edit directly, and which fact-bearing fields must remain deterministic/read-only?
2. Does a saved text edit create a new element version immediately or only after an explicit Apply action?
3. Which template/style controls are safe and finite: template, palette variant, brand asset, text alignment, or other approved parameters?
4. Is freeform positioning explicitly out of scope? Current recommendation: yes; use constrained template controls to preserve quality and deterministic QA.
5. How are edited commentary, template text, and fact-derived text distinguished in provenance?
6. What API concurrency token/version must be supplied so stale edits cannot overwrite a newer regeneration?

## 5. Existing project dependencies that remain open

- WI-1 Source of Truth U-12 remains: official brand values and assets have not been supplied.
- LIVE_DATA approval remains subject to existing verification and republishing-permission decisions; a friendlier UI does not remove those gates.
- New provider/input/shared-host/credential conditions still trigger the existing security-review requirements.
- Additive contract work for formats must follow PD-11 and the contract-change process.
- The team-name widening and other carried WI-1 open items remain outside this design refinement unless separately authorized.
- Tailwind CSS v4 installation/configuration waits for explicit UI-01 approval; exact packages and versions must satisfy the repository dependency policy.
- Next.js is not an open WI-2.1 implementation choice. It is a future architecture candidate requiring a separate decision record.
- The future SaaS business model, identity/tenant model, isolation requirements, cloud persistence, operations, and migration funding are intentionally undecided and do not block WI-2.

## 6. Explicitly closed design questions

The following are no longer open: primary terminology, provisional visual direction, create-and-generate behavior, generation completion behavior, bulk approval for the initial redesign, facts placement, manual-import placement, mobile scope, success metrics, hybrid Stitch direction, use of Tailwind CSS v4, token-driven styling, incremental CSS Modules migration, retention of Vite/React for WI-2.1, exclusion of Next.js from WI-2.1, and the requirement to preserve future SaaS portability without implementing SaaS features in WI-2. Their answers are recorded in `product-owner-decision-register.md` and must not be re-raised without new conflicting evidence.

