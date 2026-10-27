/**
 * Composition root (dependency injection by explicit construction).
 *
 * Skeleton created by T15. T19 replaces it with the full container: configuration, database, clock, logger with
 * redaction, egress client, source registry, catalogue service, AI provider and paths (architecture.md section 3,
 * contracts/provider-ports.md section 3). Secrets never enter the container's configuration object (AD-30).
 */

export interface Clock {
  now(): Date;
}

export interface AppContainer {
  readonly clock: Clock;
}

export function createContainer(): AppContainer {
  return {
    clock: { now: () => new Date() },
  };
}
