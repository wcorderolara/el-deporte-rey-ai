/**
 * Smoke unit test of the server module kit and registry (contracts/provider-ports.md section 3): the modules are
 * registered once each, in the fixed order.
 */
import { describe, expect, it } from 'vitest';

import { serverModules } from '../../src/modules/registry.js';

describe('module registry', () => {
  it('lists the server modules in order', () => {
    expect(serverModules.map((serverModule) => serverModule.name)).toEqual([
      'competitions',
      'projects',
      'imports',
      'research',
      'verification',
      'content',
      'brand',
      'design',
      'visual-templates',
      'rendering',
      'visual-qa',
      'review',
      'editorial',
      'export',
    ]);
  });

  it('has unique module names', () => {
    const names = serverModules.map((serverModule) => serverModule.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
