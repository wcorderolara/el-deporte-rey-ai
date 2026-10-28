/**
 * Shared provider-neutral domain schemas (`contracts/provider-ports.md` section 1.3, `data-model.md` section 0;
 * AD-21, R-059, R-267, R-288): Competition, Season, Stage, Matchday, Match, Team, Standing, Source, Verification
 * status, SelectionSnapshot and the listing items. The source registry applies them to every adapter output, and each
 * adapter applies them before caching. No schema here names a provider or carries a provider field name.
 */
export * from './catalogue.js';
export * from './parse.js';
export * from './rules.js';
export * from './snapshot.js';
export * from './verification.js';
