# PD-ARCH-01 — Competition-Centric Architecture

Status: architecture assessment completed; **PD-ARCH-01A accepted by the Product Owner and committed**.

This initiative separates a managed sports competition from the content projects created from it. The first slice adds a locally persisted competition name and basic create/list/read flows. It deliberately does not migrate projects, seasons, teams, match data, providers, approval records, or exports.

## Documents

- [Current architecture assessment](current-architecture-assessment.md)
- [Target domain model](target-domain-model.md)
- [Hybrid data management](hybrid-data-management-strategy.md)
- [Migration strategy](migration-strategy.md)
- [Incremental roadmap](implementation-roadmap.md)
- [Architecture decisions](architecture-decision-register.md)

## PD-ARCH-01A delivered

- Additive `competitions` SQLite table and repository.
- `GET /api/v1/competitions`, `POST /api/v1/competitions`, and `GET /api/v1/competitions/{competitionId}`.
- A Competiciones navigation entry, locally managed list/create screen, and read-only detail page.
- No provider request, project creation, or content generation is triggered by these operations.

Product Owner acceptance: manual functional review completed and accepted on 2026-10-30. PD-ARCH-01A is closed; PD-ARCH-01B remains a separate next slice.

## Manual review

Run `npm run dev`, open `http://localhost:5173/competitions`, create a competition, refresh to confirm local persistence, then open its detail page. Existing project, review and export routes remain available as before.
