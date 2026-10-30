# Architecture Decision Register

## PD-ARCH-01 decisions

PD-ARCH-01A (Competition Foundation) received Product Owner manual acceptance on 2026-10-30. Its implementation is closed at the accepted checkpoint; the next authorized slice is PD-ARCH-01B.

| ID | Decision | Reason/status |
| --- | --- | --- |
| ADR-ARCH-01 | Treat managed Competition as a persistent aggregate distinct from catalogue entries, import-scoped `manual_competitions`, projects and content. | Adopted. These current records have incompatible responsibilities and identifiers. |
| ADR-ARCH-02 | Use local operational records as the future generation source; provider synchronization is explicit and selective. | Adopted as target policy; sync is not implemented in 01A. |
| ADR-ARCH-03 | Preserve manual overrides and imported provenance through field-level version/observation history and conflict resolution. | Adopted as target policy; detailed persistence arrives with 01D. |
| ADR-ARCH-04 | Keep legacy Project/review/approval/export history intact; link new competition-first work additively and leave ambiguous old records unlinked. | Adopted. 01A adds no project FK because no safe mapping/context exists yet. |
| ADR-ARCH-05 | Apply schema changes only through additive numbered SQLite migrations. | Adopted. Migration 0003 introduces a standalone competition root. |
| ADR-ARCH-06 | Separate sports facts, AI-assisted wording, visual composition, human approvals and manual export/publication. | Adopted from product principles. No new AI/image/publishing integration is part of 01A. |

## Preserved WI-1/WI-2 decisions

- Existing business and integrity rules remain authoritative, including provider neutrality, versioned manual imports, verified/manual/demo distinctions, version-specific approval, traceable export and no social publishing.
- Tailwind v4, design tokens, React/Vite/Router and AppShell remain the frontend foundation.
- Verification follows PD-UI-21: no E2E or automated visual/browser checks in this initiative unless separately authorized. Run targeted checks requested for the slice.
- Do not commit, merge, push or deploy without the applicable explicit Product Owner instruction.
