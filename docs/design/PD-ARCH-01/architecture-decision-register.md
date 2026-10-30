# Architecture Decision Register

## PD-ARCH-01 decisions

PD-ARCH-01A (Competition Foundation) and PD-ARCH-01B (Seasons & Participants) received Product Owner acceptance on 2026-10-30. Their implementation checkpoints are closed; PD-ARCH-01C is the next authorized slice.

| ID | Decision | Reason/status |
| --- | --- | --- |
| ADR-ARCH-01 | Treat managed Competition as a persistent aggregate distinct from catalogue entries, import-scoped `manual_competitions`, projects and content. | Adopted. These current records have incompatible responsibilities and identifiers. |
| ADR-ARCH-02 | Use local operational records as the future generation source; provider synchronization is explicit and selective. | Adopted as target policy; sync is not implemented in 01A. |
| ADR-ARCH-03 | Preserve manual overrides and imported provenance through field-level version/observation history and conflict resolution. | Adopted as target policy; detailed persistence arrives with 01D. |
| ADR-ARCH-04 | Keep legacy Project/review/approval/export history intact; link new competition-first work additively and leave ambiguous old records unlinked. | Adopted. 01A adds no project FK because no safe mapping/context exists yet. |
| ADR-ARCH-05 | Apply schema changes only through additive numbered SQLite migrations. | Adopted. Migration 0003 introduces a standalone competition root. |
| ADR-ARCH-06 | Separate sports facts, AI-assisted wording, visual composition, human approvals and manual export/publication. | Adopted from product principles. No new AI/image/publishing integration is part of 01A. |
| ADR-ARCH-07 | A season is unique by normalized label within one managed competition and is retained as history. | Adopted in 01B; `2026/27` and `2027` remain valid labels. |
| ADR-ARCH-08 | Reuse one global managed team by exact normalized name+optional region; do not fuzzy-merge similar names. | Adopted in 01B. A region distinguishes same-named clubs when needed; provider IDs are absent. |
| ADR-ARCH-09 | Season membership is unique per `(season, team)`; unlinking removes only that relation. | Adopted in 01B; team catalog entries are retained. |

## PD-ARCH-01B acceptance

The Product Owner approved PD-ARCH-01B on 2026-10-30 after functional and visual review. The approved implementation and documentation are committed on `work/PD-ARCH-01B`; see the implementation report for the checkpoint SHA. It is not merged.

## Preserved WI-1/WI-2 decisions

- Existing business and integrity rules remain authoritative, including provider neutrality, versioned manual imports, verified/manual/demo distinctions, version-specific approval, traceable export and no social publishing.
- Tailwind v4, design tokens, React/Vite/Router and AppShell remain the frontend foundation.
- Verification follows PD-UI-21: no E2E or automated visual/browser checks in this initiative unless separately authorized. Run targeted checks requested for the slice.
- Do not commit, merge, push or deploy without the applicable explicit Product Owner instruction.
