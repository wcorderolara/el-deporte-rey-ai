# Future SaaS Readiness and Migration Considerations

Status: Future architectural direction; no WI-2 implementation authorized
Date: 2026-10-29

## 1. Direction and boundary

El Deporte Rey AI begins as an internal, local-first sports content creation tool. It may later become a commercial SaaS product for independent sports creators, media organizations, and content production teams.

Current development should preserve reasonable architectural portability toward a multi-user, multi-tenant product. This is not a requirement to build speculative SaaS infrastructure now. WI-2 remains a UX/UI redesign of the existing single-operator application.

Next.js is the preferred candidate for a future web application framework. It is not selected for implementation in WI-2 and does not supersede the approved React, React Router, Vite, and TypeScript baseline.

## 2. Explicit WI-2 non-goals

Do not introduce during WI-2:

- Authentication, registration, invitations, roles, or user profiles.
- Organizations, workspaces-as-tenants, tenant selectors, or tenant identifiers.
- Subscription plans, billing, quotas, metering, or entitlements.
- Cloud databases, object storage, queues, hosted background processing, or SaaS deployment.
- Framework migration, Next.js routes, server components, server actions, or SSR.
- Tenant-aware API or database changes.
- Provider, repository, or domain abstractions that have no current use and exist only for hypothetical SaaS requirements.

The existing local-only security, persistence, API, workflow, approval, traceability, and export controls remain authoritative.

## 3. Future architectural decisions

These decisions guide future evaluation and changed-code boundaries. They do not authorize implementation.

| ID | Future decision | Portability implication now | Separate future decision required |
| --- | --- | --- | --- |
| FAD-SAAS-01 | Keep reusable UI components separate from route mechanics. | Shared components receive content, state, callbacks, and navigation intent; route-level screens own URL parameters, loaders, navigation, and page composition. Do not refactor stable code solely to satisfy this ideal. | Route model, deep-link policy, and Next.js routing strategy. |
| FAD-SAAS-02 | Keep business and domain rules independent of the frontend framework. | React components orchestrate presentation; validation, workflow invariants, approval rules, and content semantics remain in domain/application boundaries. | Server/client execution ownership and domain-package topology. |
| FAD-SAAS-03 | Keep AI providers behind provider-neutral generation capabilities. | Workflows request generation outcomes and preserve provenance without importing vendor-specific UI assumptions. Existing adapter and security controls remain. | Provider tenancy, credential ownership, routing, quotas, cost controls, and failover. |
| FAD-SAAS-04 | Separate brand configuration from application theme. | Semantic UI tokens define product interaction states; brand assets and creative-template configuration remain replaceable data/configuration. Tenant branding must not be simulated in WI-2. | Brand inheritance, tenant customization limits, asset authorization, storage, and moderation. |
| FAD-SAAS-05 | Keep persistence details outside domain rules. | Domain/application behavior should not depend directly on filesystem paths, browser storage, or a specific database API. Continue using current supported persistence boundaries; do not add unused repositories. | Tenant-scoped data model, database choice, object storage, migrations, retention, backup, and residency. |
| FAD-SAAS-06 | Treat Next.js as the preferred candidate, not a predetermined migration. | Keep components, tokens, contracts, and domain interfaces portable; do not introduce Next.js conventions into the Vite application. | Architecture decision record comparing measurable benefits, migration cost, security, operations, rendering model, and compatibility. |
| FAD-SAAS-07 | Preserve explicit contracts and traceability across a future distributed system. | WI-2 does not change APIs. Continue typed, versioned/additive boundaries and immutable approval/export trace where already provided. | Public/internal API boundary, tenant context propagation, idempotency, async job protocol, audit retention, and compatibility policy. |
| FAD-SAAS-08 | Design identity, tenancy, and isolation together in a future security program. | Do not add placeholder tenant IDs or weak client-side access controls. Preserve the current loopback/local security model. | Authentication, authorization, tenant isolation, service identity, secrets, threat model, incident response, and compliance. |

## 4. Guardrails for WI-2 changes

Apply these guardrails proportionally when a component or boundary is already being changed:

1. Route-level modules translate URL/navigation state into component props and actions.
2. Shared visual components do not import domain infrastructure or AI SDKs.
3. UI copy and controls consume creator-facing states rather than provider-specific status names.
4. Design Tokens separate semantic application states from provisional El Deporte Rey brand values.
5. Brand asset slots use current authorized configuration rather than hardcoded tenant assumptions.
6. Domain decisions are not derived from CSS, route paths, local filenames, or browser storage keys.
7. Existing API clients and application services remain the integration boundary; components do not create alternative persistence paths.
8. Avoid premature abstractions: portability is demonstrated through clear ownership and tests, not unused interfaces.

## 5. Future migration gates

A SaaS program should not begin with a framework replacement. It requires separately approved gates:

1. **Product and commercial model:** target customers, collaboration model, roles, pricing assumptions, service expectations, and data ownership.
2. **Tenancy and security architecture:** tenant boundary, identity, authorization, isolation, audit, secrets, abuse controls, and threat model.
3. **Domain and persistence assessment:** data ownership, repository seams, migration, object storage, asynchronous workflows, retention, backup, and recovery.
4. **Framework architecture decision:** validate Next.js against alternatives and the chosen rendering/deployment model; define an incremental route/component migration with rollback.
5. **Operational readiness:** environments, observability, support, availability targets, cost controls, privacy, compliance, incident response, and disaster recovery.
6. **Migration delivery:** preserve existing projects, approvals, exports, provenance, provider permissions, and security controls through staged compatibility testing.

Each gate requires its own scope, decision record, risks, acceptance criteria, and Product Owner approval.

## 6. Relationship to WI-2

- UI-01 may create portable tokens, primitives, and a route-composed shell, but it does not build SaaS infrastructure.
- UI-02 through UI-06 preserve existing application and API behavior while improving the creator experience.
- Additional static formats remain a separate product/architecture track and must not be used to introduce tenancy implicitly.
- Tailwind adoption does not imply Next.js adoption.
- The selected Stitch direction remains a visual reference and has no authority over future hosting, routing, tenancy, or persistence architecture.

## 7. Contradiction assessment

There is no contradiction with the existing local-first architecture. The current application stays single-operator, loopback-bound, locally persisted, and framework-stable for WI-2. The future SaaS direction only records portability preferences and the decisions that would be required before changing that model.

There is also no contradiction with PD-UI-19: Next.js remains outside WI-2. PD-UI-20 clarifies that it is the preferred future candidate for a separately approved SaaS web architecture, not an authorized current migration.
