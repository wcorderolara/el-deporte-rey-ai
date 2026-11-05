/**
 * Shared Zod schemas and TypeScript types:
 * - the mirror of the HTTP contract `contracts/http-api.openapi.yaml` (AD-04; the OpenAPI document is authoritative):
 *   every component schema, every operation with its inline request and response bodies, and the problem codes;
 * - the provider-neutral domain schemas (`contracts/provider-ports.md` section 1.3; AD-21).
 */
export * from './http/primitives.js';
export * from './http/system.js';
export * from './http/catalog.js';
export * from './http/facts.js';
export * from './http/projects.js';
export * from './http/competitions.js';
export * from './http/content-batches.js';
export * from './http/review.js';
export * from './http/exports.js';
export * from './http/imports.js';
export * from './http/brand.js';
export * from './http/problem.js';
export * from './http/components.js';
export * from './http/operations.js';
export * from './domain/index.js';
