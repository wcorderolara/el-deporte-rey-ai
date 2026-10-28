/**
 * Route inventory of the running server against the contract (T43): every route the real server registers (the
 * health route and every module of the static registry, `startServer` with the T41 test support, no built UI) is a
 * contract operation, and every contract operation is served by a registered route. Fastify's automatic HEAD route of
 * a GET route is part of the GET operation (the contract's GET and HEAD rules). No registered route has publication
 * wording (R-219, BR-11).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API, startTestApp, type TestApp } from '../support/index.js';

import { contractOperations, loadContract } from './support/contract-document.js';

let t: TestApp;
let contract: Set<string>;

beforeAll(async () => {
  t = await startTestApp({ base: 'demo-manual', scenario: 'default' });
  contract = new Set(
    contractOperations(await loadContract()).map(
      (operation) => `${operation.method.toUpperCase()} ${API}${operation.path}`,
    ),
  );
});

afterAll(async () => {
  await t.close();
});

/**
 * Parses `printRoutes({ commonPrefix: false })`: one line per tree node, four columns per level, the node's path
 * segment and its methods in parentheses. Returns `METHOD path` entries with `{name}` path parameters.
 */
function registeredRoutes(tree: string): string[] {
  const stack: string[] = [];
  const routes: string[] = [];
  for (const line of tree.split('\n')) {
    const match = /^((?:[│ ] {3})*)[├└]── (\S+)(?: \(([A-Z, ]+)\))?$/u.exec(line);
    if (match === null) {
      if (line.trim() !== '') {
        throw new Error(`unparsed route line: ${line}`);
      }
      continue;
    }
    const depth = (match[1] ?? '').length / 4;
    stack.length = depth;
    stack.push(match[2] ?? '');
    const path = stack.join('').replace(/:([A-Za-z]+)/g, '{$1}');
    for (const method of (match[3] ?? '').split(',').map((entry) => entry.trim())) {
      if (method !== '') {
        routes.push(`${method} ${path}`);
      }
    }
  }
  return routes;
}

describe('server routes and contract operations (T43, AD-04)', () => {
  it('parses the route tree (the inventory is effective)', () => {
    const sample = [
      '└── /api/v1/a (GET, HEAD)',
      '    └── /:aId (PATCH)',
      '        ├── /b (GET, HEAD)',
      '        └── /c (PUT, DELETE)',
    ].join('\n');
    expect(registeredRoutes(sample)).toEqual([
      'GET /api/v1/a',
      'HEAD /api/v1/a',
      'PATCH /api/v1/a/{aId}',
      'GET /api/v1/a/{aId}/b',
      'HEAD /api/v1/a/{aId}/b',
      'PUT /api/v1/a/{aId}/c',
      'DELETE /api/v1/a/{aId}/c',
    ]);
  });

  it('registers exactly the contract operations, a HEAD route only with its GET route', () => {
    const routes = registeredRoutes(t.app.printRoutes({ commonPrefix: false }));
    const gets = new Set(routes.filter((route) => route.startsWith('GET ')).map((route) => route.slice(4)));
    const headWithoutGet = routes.filter((route) => route.startsWith('HEAD ') && !gets.has(route.slice(5)));
    expect(headWithoutGet).toEqual([]);
    const served = routes.filter((route) => !route.startsWith('HEAD '));
    expect(new Set(served).size).toBe(served.length);
    expect(served.filter((route) => !contract.has(route)).sort(), 'routes outside the contract').toEqual([]);
    expect(
      [...contract].filter((operation) => !served.includes(operation)).sort(),
      'contract operations not served',
    ).toEqual([]);
    expect(served).toHaveLength(39);
  });

  it('finds every contract operation with the router', () => {
    const missing = [...contract].filter((operation) => {
      const [method, path] = operation.split(' ') as [string, string];
      return !t.app.hasRoute({ method: method as 'GET', url: path.replace(/\{([A-Za-z]+)\}/g, ':$1') });
    });
    expect(missing).toEqual([]);
  });

  it('registers no route with publication wording (R-219)', () => {
    const routes = registeredRoutes(t.app.printRoutes({ commonPrefix: false }));
    expect(routes.filter((route) => /publish|post[-_ ]?to|share/i.test(route))).toEqual([]);
  });
});
