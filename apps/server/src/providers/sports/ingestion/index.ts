/**
 * Provider-neutral ingestion layer (contracts/provider-ports.md sections 1.1 to 1.3): port types, `SourceError`,
 * shared domain validation, the source registry and the catalogue service. It never imports an adapter.
 */
export * from './catalogue.js';
export * from './errors.js';
export * from './registry.js';
export * from './types.js';
export * from './validation.js';
export * from './local-selection.js';
