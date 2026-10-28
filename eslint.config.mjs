// ESLint flat configuration (architecture-delta.md section 7.1).
//
// Security and neutrality rules, built only from ESLint core rules (no plugin dependency):
// - Network APIs (T10-F08): `fetch`, `WebSocket` and `XMLHttpRequest` globals and the http, https, http2, net, tls,
//   dgram and undici modules are banned in server code except `apps/server/src/platform/net/**` (the egress client).
//   Server test files may use them (the Vitest network guard confines tests to loopback), except in
//   `apps/server/src/modules/export/**` and `apps/server/src/modules/imports/**`, where there is no exception.
// - `dangerouslySetInnerHTML` is banned in the web app (T10-F16).
// - Template literals with substitutions passed to `prepare` or `exec` are banned (T10-F14).
// - Provider identifiers (AD-31, R-139, R-289): in `apps/**` and `packages/**`, except
//   `apps/server/src/providers/sports/adapters/**` and `apps/server/scripts/**`, string and template literals equal
//   to the competition code or containing the provider name, provider host or competition name, the numeric or string
//   competition ID, and imports of the football-data and manual adapter directories are errors.
// - Inline configuration comments are ignored in `apps/**` and `packages/**` outside test files (T11H-F15), so no
//   disable directive can switch these rules off in core code.
//
// Flat config replaces (does not merge) the options of a rule configured by several matching objects, so each
// scope below sets the complete option set of every restricted-* rule; later objects override earlier ones.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const CODE = ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
const APP_CODE = ['apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', 'packages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'];
const TEST_FILES = ['**/*.test.{ts,tsx,mts,mjs}', '**/test/**'];
const SERVER = ['apps/server/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'];
const EGRESS = ['apps/server/src/platform/net/**'];
const NO_NETWORK_EXCEPTION = ['apps/server/src/modules/export/**', 'apps/server/src/modules/imports/**'];
const PROVIDER_EXEMPT = ['apps/server/src/providers/sports/adapters/**', 'apps/server/scripts/**'];

// ---------------------------------------------------------------------------------------------------------------
// Rule fragments
// ---------------------------------------------------------------------------------------------------------------

const NETWORK_MODULES = ['http', 'https', 'http2', 'net', 'tls', 'dgram', 'undici'];
const NETWORK_MESSAGE =
  'Network access is allowed only through the egress client in apps/server/src/platform/net (T10-F08, R-219).';
const NETWORK_MODULE_REGEX = '^(node:)?(http|https|http2|net|tls|dgram)$|^undici';

const networkImportPaths = NETWORK_MODULES.flatMap((name) =>
  name === 'undici'
    ? [{ name, message: NETWORK_MESSAGE }]
    : [name, `node:${name}`].map((n) => ({ name: n, message: NETWORK_MESSAGE })),
);
const networkImportPatterns = [{ regex: '^undici/', message: NETWORK_MESSAGE }];

const PROVIDER_MESSAGE =
  'Provider identifiers (competition codes and IDs, provider names and hosts, competition names) belong only in ' +
  'apps/server/src/providers/sports/adapters/**, apps/server/scripts/**, config/** or fixtures/** (AD-31, R-139, R-289).';
const ADAPTER_IMPORT_MESSAGE =
  'Only the adapter registry may import an adapter; use the ingestion port (R-118, R-268, AD-31).';
const adapterImportPatterns = [{ regex: '(^|/)adapters/(football-data|manual)(/|$)', message: ADAPTER_IMPORT_MESSAGE }];

const PROVIDER_TEXT = '/football-data|champions/i';
const providerSelectors = [
  { selector: "Literal[value='CL']", message: PROVIDER_MESSAGE },
  { selector: `Literal[value=${PROVIDER_TEXT}]`, message: PROVIDER_MESSAGE },
  { selector: "Literal[value='2001']", message: PROVIDER_MESSAGE },
  { selector: 'Literal[value=2001]', message: PROVIDER_MESSAGE },
  { selector: `TemplateElement[value.raw=${PROVIDER_TEXT}]`, message: PROVIDER_MESSAGE },
  {
    selector: 'TemplateLiteral[expressions.length=0] > TemplateElement[value.raw=/^(CL|2001)$/]',
    message: PROVIDER_MESSAGE,
  },
  { selector: `JSXText[value=${PROVIDER_TEXT}]`, message: PROVIDER_MESSAGE },
];

const sqlSelectors = [
  {
    selector:
      'CallExpression[callee.property.name=/^(prepare|exec)$/] > TemplateLiteral.arguments[expressions.length>0]',
    message: 'SQL must be parameterized: no template literal with substitutions in prepare or exec (T10-F14).',
  },
];

const jsxSelectors = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'dangerouslySetInnerHTML is not allowed; render text nodes only (T10-F16).',
  },
];

const dynamicNetworkSelectors = [
  { selector: `ImportExpression[source.value=/${NETWORK_MODULE_REGEX}/]`, message: NETWORK_MESSAGE },
  {
    selector: `CallExpression[callee.name='require'][arguments.0.value=/${NETWORK_MODULE_REGEX}/]`,
    message: NETWORK_MESSAGE,
  },
];

const networkGlobals = ['fetch', 'WebSocket', 'XMLHttpRequest'].map((name) => ({ name, message: NETWORK_MESSAGE }));
const networkProperties = ['globalThis', 'window', 'self', 'global'].flatMap((object) =>
  ['fetch', 'WebSocket', 'XMLHttpRequest'].map((property) => ({ object, property, message: NETWORK_MESSAGE })),
);

/** Complete restricted-* rule set for one scope. */
function restrictions({ provider, network, jsx }) {
  const syntax = [
    ...(provider ? providerSelectors : []),
    ...sqlSelectors,
    ...(jsx ? jsxSelectors : []),
    ...(network ? dynamicNetworkSelectors : []),
  ];
  const paths = network ? networkImportPaths : [];
  const patterns = [...(provider ? adapterImportPatterns : []), ...(network ? networkImportPatterns : [])];
  return {
    'no-restricted-syntax': ['error', ...syntax],
    'no-restricted-imports': ['error', { paths, patterns }],
    'no-restricted-globals': network ? ['error', ...networkGlobals] : 'off',
    'no-restricted-properties': network ? ['error', ...networkProperties] : 'off',
  };
}

// Node.js globals for plain JavaScript files (TypeScript files are checked by the compiler instead of no-undef).
const nodeGlobals = Object.fromEntries(
  [
    'process',
    'console',
    'Buffer',
    'URL',
    'URLSearchParams',
    'globalThis',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'setImmediate',
    'clearImmediate',
    'queueMicrotask',
    'structuredClone',
    'AbortController',
    'AbortSignal',
    'TextEncoder',
    'TextDecoder',
    'fetch',
    'Headers',
    'Request',
    'Response',
  ].map((name) => [name, 'readonly']),
);

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.cache/**',
      'data/**',
      '.claude/**',
      '.orchestrate/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/blob-report/**',
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },
  {
    files: CODE,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: nodeGlobals },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Core code: provider identifiers and SQL.
  { files: APP_CODE, rules: restrictions({ provider: true, network: false, jsx: false }) },
  // Web app: also no dangerouslySetInnerHTML.
  {
    files: ['apps/web/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    rules: restrictions({ provider: true, network: false, jsx: true }),
  },
  // Server code outside the egress client and outside tests: network APIs banned.
  {
    files: SERVER,
    ignores: [...EGRESS, ...TEST_FILES],
    rules: restrictions({ provider: true, network: true, jsx: false }),
  },
  // Export and import modules: network APIs banned with no exception, tests included (R-219).
  { files: NO_NETWORK_EXCEPTION, rules: restrictions({ provider: true, network: true, jsx: false }) },
  // Adapters and server scripts may hold provider identifiers, but production code there still has no network APIs.
  { files: PROVIDER_EXEMPT, ignores: TEST_FILES, rules: restrictions({ provider: false, network: true, jsx: false }) },
  {
    files: PROVIDER_EXEMPT.map((dir) => `${dir.slice(0, -3)}/**/*.test.{ts,tsx,mts,mjs}`),
    rules: restrictions({ provider: false, network: false, jsx: false }),
  },
  // No inline configuration in application code outside tests (T11H-F15).
  { files: APP_CODE, ignores: TEST_FILES, linterOptions: { noInlineConfig: true } },
);
