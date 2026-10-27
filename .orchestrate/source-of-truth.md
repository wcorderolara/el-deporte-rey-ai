# el-deporte-rey-ai Source of Truth

This document indexes the established facts of the project: stack, architecture, decisions, business rules, security constraints, interface contracts, quality gates and reusable components. Agents read it; briefs reference its sections instead of restating them. The process rules are not part of it: they come from the orchestrate framework workflows. The project configuration is `.orchestrate/config.json`.

Entries marked `<to be completed>` were not determined by detection. Fill them in through a tracked task; never guess.

## 0. Precedence

When sources conflict, the higher level wins. The six levels and the concrete sources at each level are recorded in the project configuration (`precedence` in `.orchestrate/config.json`); the rule itself is the framework's precedence workflow. List here only project notes about those sources:

- <to be completed>

## 1. Stack

Detected at initialization (evidence paths in the bootstrap report):

- Stack undetermined: no marker file of a known ecosystem was found. <to be completed>

Versions, install policy and runtime prerequisites:

- <to be completed>

## 2. Architecture summary

<to be completed: main components, their responsibilities and boundaries, with links to the architecture documents>

## 3. Decision register

| ID | Decision | Level | Date | Source |
|----|----------|-------|------|--------|
| PD-01 | Option (c): licensed sports-data API as preferred primary source with an independent official source for verification (BR-03), provider research by the Architect, and the conditions SC-03 and SC-04. | HIGH | 2026-10-27 | WI-1 S-001; R-410 |
| PD-02 | Option (a): scores, match dates and standings are verified only when two independent accepted sources agree, with the disagreement procedure of BR-02. | HIGH | 2026-10-27 | WI-1 S-001; R-411 |
| PD-03 | Option (c): team names as text and existing authorized brand assets, with optional badge slots reserved and no unauthorized logos. | HIGH | 2026-10-27 | WI-1 S-001; R-413 |
| PD-04 | Option (a): the initial MVP is limited to team-level and competition-level data, with no player-level information. | HIGH | 2026-10-27 | WI-1 S-001; R-414 |
| PD-05 | Option (a): single local operator without login, with development services bound to localhost only. | HIGH | 2026-10-27 | WI-1 S-001; R-415 |
| PD-06 | Language option (c), Spanish by default, and name option (i), verified official team names preserved. | HIGH | 2026-10-27 | WI-1 S-001; R-416 |
| PD-07 | The main branch is `main`. | HIGH | 2026-10-27 | WI-1 S-001 |
| PD-08 | A frontend is required, and the frontend-developer role is enabled in the project configuration through the authorized configuration workflow. | HIGH | 2026-10-27 | WI-1 S-001; R-020 |
| PD-09 | Confirms the 1080 x 1350 carousel format, individual slide/caption approval plus final approval, and league-phase-only scope for the initial MVP; no automatic publication. | HIGH | 2026-10-27 | WI-1 S-001; R-408, R-405, R-417, R-042 |
| PD-10 | Option A (U-03, HIGH-03): in-process processing of untrusted input is accepted for WI-1's scope (synthetic fixtures, stub or local AI, operator PNG or JPEG brand files) with the compensating controls of Q2 option A, under condition SC-05. | HIGH | 2026-10-27 | WI-1 S-002; security/design-review.md Q2 |
| PD-11 | The http-api contract-evolution policy (U-04, HIGH-06) is approved as written: additive-only changes within v1, and a breaking change needs a new major path and a Product Owner decision. | HIGH | 2026-10-27 | WI-1 S-002; architecture-delta.md 2.1 |

Product Owner decisions (HIGH) and architecture decisions are listed here. Orchestrator decisions (MEDIUM) are added at work-item close.

## 4. Business rules

| ID | Rule | Source |
|----|------|--------|
| BR-01 | Scores, match dates and standings are verified only when two independent accepted sources agree. | PD-02 (WI-1 S-001; R-411) |
| BR-02 | When accepted sources disagree, the official competition publication is consulted, and a disputed fact is not marked as verified until the discrepancy is resolved. | PD-02 (WI-1 S-001; R-411) |
| BR-03 | A licensed sports-data API is the preferred primary source, and an independent official source is used for verification. | PD-01 (WI-1 S-001; R-410) |
| BR-04 | The initial MVP is limited to team-level and competition-level data; player-level information is not introduced. | PD-04 (WI-1 S-001; R-414) |
| BR-05 | Team names are used as text and preserved as the verified official names. | PD-03, PD-06 (WI-1 S-001; R-413, R-416) |
| BR-06 | Only existing authorized brand assets are used; optional badge slots may be reserved, and unauthorized logos are not used. | PD-03 (WI-1 S-001; R-413) |
| BR-07 | Content language is configurable per project, with Spanish as the default. | PD-06 (WI-1 S-001; R-416) |
| BR-08 | Carousel slides use the 1080 x 1350 format. | PD-09 (WI-1 S-001; R-408) |
| BR-09 | Each slide and caption is approved individually, and the carousel requires a final approval. | PD-09 (WI-1 S-001; R-405) |
| BR-10 | The initial MVP covers the league phase only. | PD-09 (WI-1 S-001; R-417) |
| BR-11 | There is no automatic publication. | PD-09 (WI-1 S-001; R-042) |

## 5. Security constraints

| ID | Constraint | Source |
|----|------------|--------|
| SC-01 | The MVP has a single local operator without login. | PD-05 (WI-1 S-001; R-415) |
| SC-02 | Development services are bound to localhost only. | PD-05 (WI-1 S-001; R-415) |
| SC-03 | No service is purchased or subscribed to without authorization. | PD-01 (WI-1 S-001; R-410) |
| SC-04 | Synthetic fixtures are used during development. | PD-01 (WI-1 S-001; R-410) |
| SC-05 | The first real sports-data adapter, any hosted AI provider, or any new input type (SVG, HTML or web scraping, archives) requires a new security review and a new Product Owner decision on isolation of untrusted-input processing before it is introduced. | PD-10 (WI-1 S-002; security/design-review.md Q2) |

The risk profile and the sensitive-data categories are recorded in the project configuration (`riskProfile`).

## 6. Interface contracts

The declared contracts, their status, recorded hashes and frozen snapshots are in the project configuration (`contracts`). List here the interface conventions (naming, versioning, error format, compatibility policy):

- <to be completed>

## 7. Quality gates

The gates, their commands, pass conditions and applicability are in the project configuration (`gates`); the gate model is the framework's quality-gates workflow. List here only project notes about running them (disposable resources, ports, long runs):

- <to be completed>

## 8. Reusable components

| Component | Location | Use for |
|-----------|----------|---------|

## 9. Open items

| ID | Item | Owner | Status |
|----|------|-------|--------|

## 10. Maintenance

- This document is updated only through a tracked task assigned to the architect, normally at work-item close.
- Reference, do not restate: link to requirements, architecture documents, contracts and the configuration instead of copying them. There is no size limit; the document grows with the project's established facts.
- A fact in this document that contradicts a higher source (section 0) is a defect to be corrected, not a new rule.
