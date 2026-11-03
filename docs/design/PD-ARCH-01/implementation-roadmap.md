# Incremental Implementation Roadmap

| Slice | Scope | Exit condition |
| --- | --- | --- |
| **PD-ARCH-01A — Competition Foundation (accepted, merged)** | Local competition identity/persistence, create/list/read API, navigation and first list/create/detail UI. | Accepted and merged to `main` at `14dfb1f` on 2026-10-30. |
| **PD-ARCH-01B — Seasons and participants (accepted)** | Additive season persistence, reusable local team catalogue, season membership APIs and competition/season administration screens. | Accepted by Product Owner on 2026-10-30; checkpoint `4087eec` on `work/PD-ARCH-01B`. |
| **PD-ARCH-01C — Calendar and results (accepted and closed)** | Add flexible optional stages/rounds, season-owned matches, manual results and append-only change history. Includes additive `0006` compatibility correction, `0007` competition-team membership, `0008` independent status/scores and hierarchical administration UX. | Product Owner acceptance recorded 2026-11-03; technical verification passed and checkpoint committed on `work/PD-ARCH-01C`. |
| PD-ARCH-01D — Hybrid data integration (proposal under review) | Source-neutral bindings/capabilities, explicit scoped sync previews, reviewable conflicts and field-level manual override protection. | Architecture proposal reviewed and approved before implementation; sync remains opt-in and never silently overwrites manual corrections. |
| PD-ARCH-01E — Reusable content relationship | Add content items linked to competition context and nullable project compatibility; preserve legacy records. | Multiple content items reuse local sports data; old WI-1 project/review/export flows continue to work. |
| PD-ARCH-01F — Local-data generation integration | Feed selected/versioned local records into existing generation pipeline without adding an AI provider or changing rendering. | Generation has no implicit provider lookup and each output is traceable to its local data snapshot. |

Do not combine all future entities and migrations into 01A. Each slice needs its own acceptance and migration review.

## 01A implementation notes

- UI routes: `/competitions` and `/competitions/:competitionId`.
- API: `GET /competitions`, `POST /competitions`, `GET /competitions/{competitionId}` under `/api/v1`.
- Creation only requires a display name and does not make provider calls.
- No edit/delete, season administration or linkage to projects is claimed in this slice.
