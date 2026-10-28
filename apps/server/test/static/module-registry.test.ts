/**
 * Smoke unit test of the server module kit and registry (contracts/provider-ports.md section 3): the ten modules are
 * registered once each, in the fixed order.
 */
import { describe, expect, it } from 'vitest';

import { serverModules } from '../../src/modules/registry.js';

describe('module registry', () => {
  it('lists the ten server modules in order', () => {
    expect(serverModules.map((serverModule) => serverModule.name)).toEqual([
      'projects',
      'imports',
      'research',
      'verification',
      'content',
      'brand',
      'rendering',
      'visual-qa',
      'review',
      'export',
    ]);
  });

  it('has unique module names', () => {
    const names = serverModules.map((serverModule) => serverModule.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
