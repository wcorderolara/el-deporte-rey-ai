# Incremental Implementation Roadmap

| Slice | Scope | Exit condition |
| --- | --- | --- |
| **PD-ARCH-01A — Competition Foundation (accepted, closed)** | Local competition identity/persistence, create/list/read API, navigation and first list/create/detail UI. | Accepted by Product Owner after manual review on 2026-10-30. |
| **PD-ARCH-01B — Seasons and participants (next)** | Add seasons, local teams, season participation and basic management. | A competition can own multiple seasons and independently roster teams. |
| PD-ARCH-01C — Calendar and results | Add flexible stages/rounds, matches and manual result entry with validation/version history. | League, groups, knockout and special schedule shapes are representable without fabricated values. |
| PD-ARCH-01D — Provider bindings and explicit sync | Source-neutral binding/capability model, scoped synchronization records, reviewable conflicts and manual overrides. | Sync is opt-in and never silently overwrites manual corrections. |
| PD-ARCH-01E — Reusable content relationship | Add content items linked to competition context and nullable project compatibility; preserve legacy records. | Multiple content items reuse local sports data; old WI-1 project/review/export flows continue to work. |
| PD-ARCH-01F — Local-data generation integration | Feed selected/versioned local records into existing generation pipeline without adding an AI provider or changing rendering. | Generation has no implicit provider lookup and each output is traceable to its local data snapshot. |

Do not combine all future entities and migrations into 01A. Each slice needs its own acceptance and migration review.

## 01A implementation notes

- UI routes: `/competitions` and `/competitions/:competitionId`.
- API: `GET /competitions`, `POST /competitions`, `GET /competitions/{competitionId}` under `/api/v1`.
- Creation only requires a display name and does not make provider calls.
- No edit/delete, season administration or linkage to projects is claimed in this slice.
