# WI-2 UX/UI Discovery Deliverables

- [Current screen inventory and journey map](current-screen-inventory-and-journey-map.md)
- [UX/UI redesign proposal](ux-ui-redesign-proposal.md)
- [Product Owner decision register](product-owner-decision-register.md)
- [Revised guided user journey](guided-content-creation-journey.md)
- [Static content format roadmap](static-content-format-roadmap.md)
- [Incremental UX/UI implementation plan](incremental-ux-ui-implementation-plan.md)
- [Tailwind CSS v4 migration strategy](tailwind-v4-migration-strategy.md)
- [UI-01A foundation implementation record](ui-01a-foundation-implementation-record.md)
- [UI-01B shell and navigation scope](ui-01b-shell-and-navigation-scope.md)
- [UI-01B implementation report](ui-01b-shell-implementation-report.md)
- [UI-02 dashboard and creation entry scope](ui-02-dashboard-and-creation-entry-scope.md)
- [UI-02 implementation and visual evidence](ui-02-creator-dashboard-implementation-report.md)
- [UI-03 guided creation implementation and visual evidence](ui-03-guided-content-creation-implementation-report.md)
- [UI-04A review workspace implementation report](ui-04a-review-workspace-implementation-report.md)
- [UI-04B bulk approval implementation report](ui-04b-bulk-approval-implementation-report.md)
- [UI-06 scope and increments](ui-06-scope-and-increments.md)
- [UI-06.1 E2E and accessibility recovery report](ui-06-1-e2e-a11y-recovery-report.md) — accepted and closed; includes the E2E-F01 correction and the defect and findings register (section 4.4)
- [UI-06 evidence](evidence/UI-06/) — suite logs before and after, the final verification, the E2E-F01 ZIP summary and the mutation check
- [Future SaaS readiness and migration considerations](future-saas-readiness-considerations.md)
- [Open design dependencies and questions](open-design-dependencies.md)

These documents preserve the design decisions and increment reports. UI-01A, UI-01B, UI-02, UI-03, UI-04A, and UI-04B are accepted. UI-02 is checkpointed at `41ea6f70aba4a58df1d5604f1956b4e660dbbf4a`; UI-03, UI-04A, and UI-04B are closed on their dedicated branches. UI-05 has not started. Merge, push, or deployment requires the applicable Product Owner authorization. UI-06.1 (E2E and accessibility recovery, with the correction of the export defect E2E-F01) was accepted and closed on 2026-11-13 on `work/WI-2-UI-06`; UI-06.2 and UI-06.3 are not started, and the accessibility and responsive findings A11Y-01, A11Y-02, R-02 and R-03 stay open for UI-06.2.

The approved product direction is a local, AI-assisted **static sports content creation studio**. It creates, customizes, reviews, approves, and downloads creative assets; it does not publish, schedule, manage social accounts, or create/edit video.

The current product remains an internal, local-first tool. Its UI and application boundaries should avoid unnecessary coupling so a separately approved future program can evaluate a multi-user, multi-tenant SaaS evolution. This portability direction does not introduce SaaS functionality into WI-2.

