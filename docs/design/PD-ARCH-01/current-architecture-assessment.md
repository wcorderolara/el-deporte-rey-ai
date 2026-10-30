# Current Architecture Assessment

## Findings

The accepted WI-2 baseline is `f25df3a` on the dedicated `work/PD-ARCH-01` branch. The application is a local single-operator React 19/Vite frontend and Node/Fastify API, with Zod contracts, module boundaries, SQLite persistence, provider ports, and additive numbered SQL migrations.

| Existing concept | Current responsibility | Architectural distinction |
| --- | --- | --- |
| `projects` | One selected competition/source/season/stage/matchday and language for a content workflow | A project is a workflow/content workspace, not a durable competition aggregate. It stores catalogue IDs and display snapshots. |
| `workflow_runs`, `facts`, `content_drafts`, `carousels`, element versions, approvals, exports | Execution and lifecycle for generated content | These records are project-scoped and form the accepted WI-1 audit, review, approval, and export chain. |
| `/catalog/competitions` and catalogue adapters | Dynamic provider-neutral view of configured sources and their availability | Catalogue entries are not locally owned or editable. Provider references remain opaque. |
| `manual_competitions`, `manual_seasons`, `manual_selection_versions`, `imports` | Versioned manual data import records | `manual_competitions` is created from an applied import, requires source/import provenance, and rejects conflicting metadata. It is not a general competition administration entity. |
| `teams` and run facts/observations | Existing team identity and run-level sports facts | These are not a complete reusable competition calendar/season dataset. |

The research workflow may retrieve sports information when a run is started. That existing behavior remains intact for WI-1. The target architecture must move future competition-first content generation to local selected data and require an explicit sync action; it must not make current project runs silently change behavior in this slice.

## Reuse

- SQLite `Db` port, migration runner, transactional write boundary, and test adapters.
- Zod contracts mirrored against `contracts/http-api.openapi.yaml` and the operation registry.
- Fastify module registry and API problem semantics.
- React Router lazy feature mounts, AppShell navigation, semantic Tailwind tokens, and shared UI primitives.
- Provider-neutral domain schemas and the existing import validation/versioning and audit behavior.
- Existing project/review/approval/export aggregates without modification.

## Gaps and consequences

There is no durable operator-owned competition root. The provider catalogue, import slug registry, and project snapshot each represent different concerns. Linking any one of those identifiers directly to another would create incorrect identity assumptions. The additive `competitions` root introduced in 01A addresses only this gap; it intentionally has no seasons or imported/provider bindings yet.

Relevant sources inspected include `docs/work-items/WI-1/architecture/data-model.md`, `architecture-delta.md`, `contracts/provider-ports.md`, WI-2 decision register, migrations `0001` and `0002`, project service/repository/routes, the manual import module, contract operation registry/OpenAPI, feature routing, AppShell, and project dashboard patterns.
