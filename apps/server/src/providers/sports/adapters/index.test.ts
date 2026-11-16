/**
 * Adapter registry (contracts/provider-ports.md section 1.2; AD-22, R-118): the four kinds with their declared
 * modes, and no test-only kind (OD-24, V-52).
 */
import { describe, expect, it } from 'vitest';

import { ADAPTER_REGISTRATIONS } from './index.js';

describe('adapter registry', () => {
  it('registers fixture, football-data, local-competitions and manual with their declared modes', () => {
    expect(ADAPTER_REGISTRATIONS.map((entry) => [entry.kind, entry.mode])).toEqual([
      ['fixture', 'DEMO_DATA'],
      ['football-data', 'LIVE_DATA'],
      ['local-competitions', 'MANUAL_DATA'],
      ['manual', 'MANUAL_DATA'],
    ]);
  });

  it('never registers a test-only kind', () => {
    expect(ADAPTER_REGISTRATIONS.some((entry) => entry.kind.startsWith('test-'))).toBe(false);
  });
});
