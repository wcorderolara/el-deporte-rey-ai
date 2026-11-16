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
| ADR-ARCH-10 | Stages and rounds are optional calendar groupings, not required season structure. Rounds may be direct to a season or nested under a stage; matches can be direct, stage-only, round-only or stage-round. | Adopted in 01C; no synthetic phase or numeric/consecutive round assumption. Season is always required. |
| ADR-ARCH-11 | A match has one current result pair and append-only state/schedule/result snapshots. | Adopted in 01C; manual status transitions are unrestricted and state is independent from a nullable, paired nonnegative score. No-op updates do not append history. |
| ADR-ARCH-12 | A season participant referenced by a match cannot be unlinked. | Adopted in 01C to preserve season membership and match foreign-key integrity; unused participants remain unlinkable. |
| ADR-ARCH-13 | Evolve applied calendar storage only through an additive migration; preserve legacy score columns while introducing normalized current-result rows and optional history context. | Adopted for the 01C blocking compatibility correction after reproducing `no such table: match_results` against a database already at migration 0005. |
| ADR-ARCH-14 | Separate global Team identity, competition association and season participation as `Team`, `CompetitionTeam` and `SeasonParticipant`. Backfill historical participants through an additive migration; enroll multiple teams transactionally. | Adopted in PD-ARCH-01C. No team identity or existing season/match relation is rebuilt or deleted. |
| ADR-ARCH-15 | Edit global Team fields through its stable team ID; remove a competition association only when no season in that competition uses the team. | Adopted in PD-ARCH-01C. Team updates are visible anywhere that identity is reused; unlinking never deletes the catalog Team and is blocked while season participants depend on it. |
| ADR-ARCH-16 | Manual match administration permits any status-to-status change; score pairs may be present in any status. | Adopted in PD-ARCH-01C. `null/null` represents no result; `0/0` is a recorded score. Migration 0008 relaxes the legacy status/score CHECK without changing match IDs or history. |

## PD-ARCH-01B acceptance

The Product Owner approved PD-ARCH-01B on 2026-10-30 after functional and visual review. The approved implementation and documentation are committed at `4087eec` on `work/PD-ARCH-01B`. It is not merged.

## PD-ARCH-01C status

The Product Owner accepted PD-ARCH-01C on 2026-11-03. Implementation is on `work/PD-ARCH-01C`, based on PD-ARCH-01B checkpoint `4087eec`. Technical checks passed and the accepted implementation was closed in the branch checkpoint; see the 01C implementation report for verification and commit SHA.

PD-ARCH-01D is in architecture proposal/review only. No provider, migration or implementation is approved.

## Preserved WI-1/WI-2 decisions

- Existing business and integrity rules remain authoritative, including provider neutrality, versioned manual imports, verified/manual/demo distinctions, version-specific approval, traceable export and no social publishing.
- Tailwind v4, design tokens, React/Vite/Router and AppShell remain the frontend foundation.
- Verification follows PD-UI-21: no E2E or automated visual/browser checks in this initiative unless separately authorized. Run targeted checks requested for the slice.
- Do not commit, merge, push or deploy without the applicable explicit Product Owner instruction.
