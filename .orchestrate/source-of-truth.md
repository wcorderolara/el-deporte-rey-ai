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

Product Owner decisions (HIGH) and architecture decisions are listed here. Orchestrator decisions (MEDIUM) are added at work-item close.

## 4. Business rules

| ID | Rule | Source |
|----|------|--------|

## 5. Security constraints

| ID | Constraint | Source |
|----|------------|--------|

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
