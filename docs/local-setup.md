# Local setup

How to install, run and test El Deporte Rey GT on one machine. The platform is a local, single-operator service: it
listens on `127.0.0.1` only, has no login, and runs the whole workflow (catalogue selection, research, fact
verification, content, slide rendering, visual QA, approval and export) on the local machine. In the default
configuration it makes no external request at all; with LIVE_DATA or a hosted AI provider enabled it reaches only the
configured provider origins.

## 1. Host prerequisites

| Item | Value |
| ---- | ----- |
| Runtime | Node.js `22.22.2` exactly (pinned in `.nvmrc` and in `engines.node`, `>=22.22.2 <23`), with its bundled npm. `engine-strict` refuses other versions. |
| Other host software | None. Nothing is installed globally; browsers for the end-to-end tests are downloaded into the project (`.cache/ms-playwright`). |
| Network for tooling | `https://registry.npmjs.org/` for `npm ci` and `npm audit`; the browser download host on the first end-to-end run. This is tooling access, not product access. |

Node.js 22 prints an `ExperimentalWarning` for the built-in `node:sqlite` module; the project scripts silence it with
`--disable-warning=ExperimentalWarning`.

## 2. Install

```sh
npm ci
```

The committed `.npmrc` pins exact versions (`save-exact`), refuses other Node.js versions (`engine-strict`), runs no
install script (`ignore-scripts`), uses only `https://registry.npmjs.org/` and holds no auth token. Peer dependencies
are never installed implicitly (`legacy-peer-deps`); each one the project needs is declared at an exact version.
Always install with `npm ci` from the committed `package-lock.json`.

## 3. Run

| Use | Command | Address |
| --- | ------- | ------- |
| Development | `npm run dev` | API `http://127.0.0.1:4300` (watch mode) and Vite `http://127.0.0.1:5173` with `/api` proxied to the API |
| Development with football-data.org | `EDR_CONFIG=config/dev-live.config.json npm run dev` | Same separate API + Vite workflow; uses the existing `data/` database |
| Local use | `npm run build`, then `npm start` | UI and API on `http://127.0.0.1:4300` |
| Verification runs (gates, verify worktree) | started by the end-to-end runner | `http://127.0.0.1:4310` |
| Product Owner demonstration (demo worktree) | started for the demonstration only | `http://127.0.0.1:4320` |

- Binding: the server and the Vite servers bind to `127.0.0.1` only. The configuration refuses any other host.
  Changing the binding or adding remote access is a security-sensitive change that needs a Product Owner decision.
- Host and Origin allow-lists: the API accepts only the exact `host:port` values and origins listed in the
  configuration, never derived from request headers, never `0.0.0.0` or a wildcard. Production (`npm start`) allows
  the Hosts `127.0.0.1:4300` and `localhost:4300` and the matching origins `http://127.0.0.1:4300` and
  `http://localhost:4300`. Development (`npm run dev`) adds `127.0.0.1:5173` and `localhost:5173` and their origins.
  The verification (`4310`) and demonstration (`4320`) configurations list their own port in the same way.
- Data: `data/` in the working tree (git-ignored), or the directory named by `EDR_DATA_DIR`; created with mode 0700.
  Tests use temporary directories that are removed after the run.
- Other environment variables: `EDR_CONFIG` (alternative configuration file), `EDR_DATA_DIR`, `EDR_PORT`. The `dev:api` script
  honors an explicit `EDR_CONFIG`; when unset it uses `config/dev.config.json`.

## 4. Host assumptions and credentials

**Single-user workstation only.** A loopback listener accepts connections from every process of every OS account on
the machine, and possibly from containers or virtual machines that share the host network namespace. The platform
therefore assumes a single-user workstation. Do not run it on a shared or multi-user host, and never run it with a paid
AI key or a real provider token on a shared host.

**Credentials live only in `.env.local`**, which is git-ignored and must be readable by its owner only (mode 0600).
`.env.example` lists the variables with empty values. Create the file without ever typing a secret on the command
line:

```sh
umask 077 && touch .env.local && chmod 600 .env.local
# then open .env.local in an editor and fill in only the variables you need
```

The scripts load it with `node --env-file-if-exists=.env.local`. Variables already set in the environment take
precedence.

**Conditions for using a real football-data.org token (Product Owner decision PD-16, source of truth SC-08):**

- only on a single-user workstation, with `.env.local` at mode 0600;
- a free-plan football-data.org token only; no subscription is purchased or upgraded;
- a LIVE_DATA configuration is enabled only when needed; otherwise the default
  configuration (DEMO_DATA and MANUAL_DATA) is used;
- the request-budget controls of the provider adapter stay in place;
- a new Product Owner decision is required before a paid plan is used, before the platform runs on a shared or
  multi-user host, and before real non-public data is introduced.

**Handling the token safely:**

- Check that the token is present without printing it. The following command prints only a count (`1` when present):

  ```sh
  grep -c '^FOOTBALL_DATA_API_TOKEN=..*' .env.local
  ```

- Never display the value: do not use `cat`, `less`, `printenv`, `env`, `echo $FOOTBALL_DATA_API_TOKEN`, a viewer or
  read tool on `.env.local`, or shell tracing (`set -x`) while the file or the variable is in use. Never paste the
  token into a chat, an issue, a commit, a log or test evidence.
- Do not enable Node.js diagnostic reports or heap snapshots while a token is configured: no `--report-on-fatalerror`,
  `--report-uncaught-exception`, `--report-on-signal`, `--heapsnapshot-signal` or `--heapsnapshot-near-heap-limit`
  flags and no such `NODE_OPTIONS`. Reports contain the process environment and snapshots contain the memory that holds
  the token. No project script enables them.
- The token is sent only in the `X-Auth-Token` header to `https://api.football-data.org`, from the server; it never
  reaches the browser, the database, the logs or an API response.

## 5. Data modes

| Mode | How to enable | External access |
| ---- | ------------- | --------------- |
| DEMO_DATA (synthetic fixtures) | default configuration | none |
| MANUAL_DATA (JSON, CSV or form imports) | default configuration | none |
| LIVE_DATA (football-data.org API v4), compiled app | `EDR_CONFIG=config/live.config.json` and `FOOTBALL_DATA_API_TOKEN` in `.env.local` | `https://api.football-data.org` only |
| LIVE_DATA, Vite development | `EDR_CONFIG=config/dev-live.config.json` and `FOOTBALL_DATA_API_TOKEN` in `.env.local` | `https://api.football-data.org` only |

LIVE_DATA setup, step by step:

1. Confirm the PD-16 conditions of section 4 (single-user workstation, free-plan token).
2. Create `.env.local` as shown in section 4 and put the token in `FOOTBALL_DATA_API_TOKEN=` with an editor.
3. Check presence with `grep -c '^FOOTBALL_DATA_API_TOKEN=..*' .env.local` (prints a count, never the value).
4. For local development with hot reload, run `EDR_CONFIG=config/dev-live.config.json npm run dev`. This starts the API
   separately on port 4300 and Vite on port 5173; Vite proxies `/api` to the API. The development configuration keeps
   the exact local Host/Origin allowlist and uses the existing `data/` database, preserving access to locally managed
   competitions. Set `EDR_DATA_DIR` if a separate test database is preferred.
   Open **http://127.0.0.1:5173** to see React edits through Vite HMR. Port 4300 serves the last compiled frontend;
   editing `apps/web/src/ui/Layout.tsx` will not change that page until `npm run build` runs again. Check the browser
   address bar if an edit appears unchanged. The two processes still run separately under the root `dev` command.
   To use the compiled single-server app instead, run `npm run build`, then
   `EDR_CONFIG=config/live.config.json npm start`.
   With LIVE_DATA enabled and the token missing or empty, startup stops with an error that names the variable, never
   a value. Without LIVE_DATA the token is neither required nor read.
5. When done, stop the processes. The normal `npm run dev` uses `config/dev.config.json` by default. `npm start` keeps
   serving the compiled UI and API on port 4300.

Facts retrieved from football-data.org alone stay unverified (awaiting independent verification) until an independent
accepted source is configured, and LIVE_DATA content is not publication-approvable until the provider's written
republishing permission is recorded as a Product Owner decision. A hosted AI provider is used only after a Product
Owner decision; its key goes in `EDR_AI_API_KEY` in `.env.local` under the same rules.

## 6. Tests

| Command | Scope |
| ------- | ----- |
| `npm run typecheck`, `npm run lint` | type safety, static analysis (security rules, provider-identifier rule), formatting |
| `npm run test:unit`, `npm run test:integration`, `npm run test:contract` | default suites |
| `npm run test:e2e`, `npm run test:a11y` | browser journeys and accessibility checks on the built app (`127.0.0.1:4310`) |

The default suites run on DEMO_DATA. Their shared setup removes `FOOTBALL_DATA_API_TOKEN`, `EDR_AI_API_KEY` and
`EDR_LIVE_TESTS` from the environment and installs a network guard that fails any test that connects to a non-loopback
address. Tests use synthetic credential values (`edr-test-marker-token-0000`, `edr-test-dummy-key-0000`), never real
ones.

### Optional live checks (manual, never in a gate)

- `npm run test:live` runs the live tests only when `EDR_LIVE_TESTS=1` and `FOOTBALL_DATA_API_TOKEN` are both set;
  otherwise every live test is skipped. They make at most 5 requests and assert shapes only.
- `npm run probe:football-data -- --out <file>` builds the server and runs the credential-safe capability probe. It is
  run by the Orchestrator only when the Product Owner has placed a token in `.env.local`.
- Neither is a configured gate, and no default suite or gate needs the token or access to the provider.
