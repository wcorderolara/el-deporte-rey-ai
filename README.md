# El Deporte Rey GT: AI sports-content platform (MVP)

A local, single-operator web application that turns football match data into Instagram carousel drafts (1080 x 1350)
for review. One Node.js process, bound to `127.0.0.1` only, serves the web UI and a JSON HTTP API, runs the content
workflow in process (research, verification, content, rendering, visual QA), stores its data in a local SQLite file
and data directory, and calls external providers only through configured adapters. There is no login, no automatic
publication and no remote access.

Setup, ports, credentials and the host assumptions: [docs/local-setup.md](docs/local-setup.md).

## Data modes

Every configured sports-data source has exactly one data mode. All modes produce the same provider-neutral domain
representation (competitions, seasons, stages, matchdays, matches, teams, standings), so the workflow never depends on
a mode, a provider or a competition. No competition is fixed in code: the catalogue is discovered from the enabled
sources.

| Mode | Data | Default |
| ---- | ---- | ------- |
| `DEMO_DATA` | Deterministic synthetic fixtures committed under `fixtures/`. Every slide and export of a demonstration project is labelled as synthetic. | On in the development configuration and in every automated test. |
| `MANUAL_DATA` | Operator imports from JSON or CSV files or the web form, validated as a whole and kept as versions with their original files. Manual data is never independent verification. | On in the development configuration. |
| `LIVE_DATA` | A licensed sports-data API over HTTPS (the first adapter is football-data.org API v4), with a token read only from the environment. | Off. Enabled only with `EDR_CONFIG=config/live.config.json` and the token in `.env.local`. |

Facts carry one status: `VERIFIED` (two independent accepted sources agree), `UNVERIFIED` with a reason, or
`MANUALLY_APPROVED` (eligible manual facts only, shown as operator-attested and never as verified).

## Requirements

- Node.js `22.22.2` exactly (`.nvmrc`, `engines`); npm as bundled with it. Nothing else is installed on the host.
- Network access to `https://registry.npmjs.org/` for `npm ci` and `npm audit` only.

## Quick start

```sh
npm ci           # clean install from the lock file; no install scripts run (ignore-scripts)
npm run dev      # API on http://127.0.0.1:4300 (watch mode) and the web UI on http://127.0.0.1:5173
```

Local use: `npm run build`, then `npm start` (one process on `http://127.0.0.1:4300`).

## Scripts

| Script | What it does |
| ------ | ------------ |
| `npm run typecheck` | Type-checks every workspace and the tests (TypeScript project references; output only under `dist/`). |
| `npm run lint` | ESLint (including the security rules and the provider-identifier rule) and the Prettier check. |
| `npm run format` | Formats the code with Prettier. |
| `npm run test:unit` | Vitest projects `unit` and `unit-web` (web tests in jsdom). |
| `npm run test:integration` | Vitest project `integration` (API-level tests on synthetic fixtures). |
| `npm run test:contract` | Vitest project `contract` (HTTP contract conformance). |
| `npm run test:live` | Optional live tests; skipped unless explicitly enabled; never part of a gate. |
| `npm run build` | Builds the workspaces (`packages/contracts`, `apps/server`, `apps/web`). |
| `npm run test:e2e` / `npm run test:a11y` | Builds, then runs the end-to-end journeys or the accessibility checks. |
| `npm run dev` / `npm start` | Development servers / the built server. |
| `npm run probe:football-data` | Optional, manual capability probe of the LIVE_DATA provider (see the local setup). |

Every default test runs on synthetic data, without any provider credential, behind a network guard that fails any
connection to a non-loopback address.

## Repository layout

- `apps/server`: Fastify server, workflow, modules (`src/modules/*`), providers (`src/providers/*`), platform code.
- `apps/web`: React UI (Vite).
- `packages/contracts`: shared Zod schemas and types of the HTTP contract and the domain.
- `config/`: committed, non-secret configuration. `fixtures/`: synthetic test data. `e2e/`: browser tests.
- `data/`: runtime data (git-ignored).
