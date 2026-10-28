# WI-1 T60: Security check of the probe diagnostics (FU-2)

```
TASK: WI-1-T60  RESULT: PASS
HEAD: n/a  BASE: 3313782cc78b8260a1f26a42dd5d21ef49b006c0
FILES: docs/work-items/WI-1/security/review-T60-probe-diagnostics.md
COMMANDS: n/a
DECISIONS: LOW-1: review mode is delta validation of T59 (integrated at 7845e6f, contained in BASE) against T11H-F02, T11H-F04, T11H-F20/Q8 and the T10 logging and redaction controls ; LOW-2: finding IDs T60-F01..T60-F06 ; LOW-3: pre-existing probe outputs that T59 did not change (catalogue names, stage values, season labels) are listed as context, not re-reviewed
ESCALATIONS: none
```

## 1. Scope and commit reviewed

- Commit: BASE `3313782` (worktree `WI-1-T60`, branch `task/WI-1/T60`). T59 is integrated in it through `7845e6f` (merge of `task/WI-1/T59`, agent commit `db29748`).
- Mode: delta validation of T59 (OD-60, PD-24), as the gate to the second live run with the Product Owner's real free-plan token (T61).
- Files reviewed:
  - `apps/server/scripts/football-data-probe.ts` and `football-data-probe.test.ts`;
  - `apps/server/src/providers/sports/adapters/football-data/`: `observation.ts`, `provider.ts`, `mapping.ts` (FU-1 part), `constants.ts`, `options.ts` (read for bounds), `errors.test.ts`, `diagnostics.test.ts`, `mapping.test.ts`, `live-config.test.ts`;
  - `config/live.config.json`;
  - read only: `apps/server/src/providers/sports/ingestion/validation.ts`, `packages/contracts/src/domain/parse.ts`, `apps/server/src/platform/net/egress-client.ts` (bound), `scripts/security-checks.mjs` (`marker-scan`), root `package.json` (probe script), `.gitignore`.
- Controls checked: T11H-F02 (no marker or value in probe output, `--require-token` scan), T11H-F04 (`X-Authenticated-Client` presence only), T11H-F20 and Q8 (stage-discovery cap at most 2 MiB), the T10 logging and redaction controls, and `security/design-review-change-1.md` (sections T11H-F02, T11H-F04, Q8, A1.3).
- Evidence pack: `docs/work-items/WI-1/evidence/T59-gates.txt` (RESULT: PASS, validated head `7845e6f`; all affected gates PASS), and the T59 record in the tracker (unit 2054 tests, integration 511 tests, secret-scan PASS). I have no shell. No test was run by me.

## 2. Method

1. I traced every sink of the probe: the findings file (`renderFindings`), stdout (progress lines), stderr (failure line), the uncaught-exception and unhandled-rejection handlers, and the adapter logger (`silentSportsLogger` in the probe).
2. For each new field (diagnostic path, refusal kind, rejecting stage, resource kind, failure counts per resource kind, candidate codes), I followed the value from its origin (Zod issue, `EgressError`, `SourceError.path`, argv) to the sink and noted every reduction or closed-list check on the way.
3. I checked the reduction functions by reading them: `diagnosticPath`, `declaredFieldNames`, `closedResource`, `closedRefusal`, `closedStage` and `diagnosticText`. I also read the tests with planted values that exercise them.
4. I checked the request accounting (`countingEgress`, candidate selection), the configuration bounds (`maxResponseBytesByResource`) and the `marker-scan` implementation against the T61 procedure.

## 3. Changed trust boundaries and attack surface

- No new trust boundary. The boundaries are the same as before: the provider response (untrusted) to the adapter, and the operator argv (trusted operator, untrusted shape) to the probe.
- New data flows to output sinks:
  - the egress refusal kind;
  - the rejecting stage;
  - the resource kind;
  - a reduced validation path;
  - failure counts per resource kind;
  - operator-supplied candidate codes.
- No new egress origin and no new request type. No contract, data-model or dependency change (T59 record; `orch` gates at `7845e6f`).
- Production behaviour is unchanged:
  - every observation is emitted only when an observer is attached (`provider.ts` 682, 743, 750, 776);
  - the test "observes nothing without an observer (production)" (`diagnostics.test.ts` 293-300) covers this.

## 4. Findings

There is no CRITICAL, HIGH or MEDIUM finding. Classes: 1 = acceptable for synthetic local use and for the T61 run under section 6; 2 = must be fixed before implementation or merge; 3 = blocks production use, not local use.

### T60-F01: the "Dropped keys" line can print a token-shaped or data-valued key name (LOW, non-blocking, class 1)

- **Component:** `observation.ts` `SAFE_KEY` (184) and `droppedKeyPaths` (230-257); `football-data-probe.ts` render (935-939). The behaviour exists since T49 and T59 did not change it (T59 note for T60).
- **Description:** A provider key that the allow-list drops is printed by name when it matches `/^[A-Za-z_$][A-Za-z0-9_$-]{0,40}$/`. Otherwise it is printed as `<key>`.
  - A 32-character lowercase hexadecimal token that starts with `a` to `f` matches this pattern.
  - So does a single-word data value used as an object key (for example a team name keyed map).
  - The walk stops at the first dropped key (`found.add(path)` without descending), so the prefix is made only of allow-listed keys. Each printed path is therefore short (well under the 120-character `cell` limit, 768-776), and a key is printed whole, never truncated.
- **Evidence:** the T53 findings (`research/football-data-capabilities.md` lines 135, 149, 206) show only documented v4 field names, and football-data v4 does not key objects by data values.
- **Exploitation scenario:** the provider (or an intermediary on the pinned TLS origin) returns a body with the token, or another value, as a JSON key at a position that the allow-list drops. The name is written to the findings file, which is committed.
  - This needs the provider to place the token in a response key. The provider already holds the token, so the only harm is its exposure in the repository.
- **Why acceptable for T61:** the key is printed in full, so the `--require-token` marker scan of the research folder (exact byte match on the real value, `security-checks.mjs` 862-868, 891-895) detects it, and T61 does not commit on a scan failure. Condition C7 adds a read of the dropped-key lines after a passing scan.
- **Recommended mitigation (follow-up, any later probe task):**
  - print a dropped key only when it is at most 24 characters and is not a long run of hexadecimal or base64-like characters (for example `/^[0-9A-Fa-f]{16,}$/` or more than 16 mixed alphanumerics without a separator), and print `<key>` otherwise;
  - or print only names that appear in a list of documented v4 field names;
  - add a test with a planted token-shaped key.

### T60-F02: unlisted `--candidates` codes are echoed into the findings (INFO, non-blocking, class 1)

- **Component:** `football-data-probe.ts` 695, 849-853 and 911-918.
- **Description:** Named codes, including those that the competition list does not hold, are written as `### <code>, candidate` and in the "Named candidate codes" line.
- **Evidence:** before anything is echoed, `parseCandidateCodes` (176-189) requires:
  - total length of at most 204 characters (81);
  - each code to match `COMPETITION_CODE_PATTERN` `^[A-Za-z0-9_-]{1,16}$` (`options.ts` 19);
  - no empty code, space, other separator or `=` form (the `--candidates=` form is an unknown argument, 198-216);
  - at most 12 distinct codes.

  Any violation is the closed `config` failure, with no request and no findings file. Tests `football-data-probe.test.ts` 618-648 cover a token-shaped value, a URL, a 17-character code, a repeated option, an option as the value and the equals form.
- **Assessment:** Only operator-typed text of the code shape can be echoed. A 32-character token, a URL, a header value, a team name with a space or a score with a separator cannot pass. Operator input never reaches a URL: details are requested only for items of the provider listing (`item.ref`, 711-724). Acceptable.

### T60-F03: a long diagnostic can be cut at 120 characters in the findings (LOW, accuracy only, non-blocking, class 1)

- **Component:** `football-data-probe.ts` `cell` (768-776) applied to `failedText` (809, 846, 867, 897) and to the rejections table (977). `diagnosticPath` allows up to 200 characters and 24 segments (`observation.ts` 296-297).
- **Description:** "domain validation on selection, path " uses 37 characters, so a path longer than about 83 characters loses its tail. This leaks nothing: only closed text is truncated. It can hide the failing field that T61 is meant to find. The expected CL paths (for example `/teams/2/name`, `/standings/rows/3/played`) are far shorter.
- **Mitigation (optional):** raise the cell limit for diagnostic cells to the 200-character path bound plus the prefix, or record the path on its own line.

### T60-F04: the 1 MiB stage-discovery cap is prospective, not backed by a measured size above 512 KiB (LOW, non-blocking, class 1)

- **Component:** `config/live.config.json` 76; `live-config.test.ts` 95-102; Q8 and A1.3 of `design-review-change-1.md` ("committed unset ... until T53's measured size (NV-7) justifies it").
- **Description:**
  - T53 measured at most 384,639 bytes for the season match list (CL), below 512 KiB (`research/football-data-capabilities.md` 239).
  - The 1,048,576 value is T14's proposal (LOW-5) for domestic-league seasons that T61 will probe. It is not a measurement.
  - Q8 itself classifies any value up to 2 MiB as "a configuration choice, no new security decision", and the bound is enforced in three places:
    - the option schema caps the value at `MAX_RESPONSE_BYTES_LIMIT` = 2 MiB (`options.ts` 103-104, `egress-client.ts` 22);
    - the egress client refuses any request with a cap out of range (`egress-client.ts` 60-61);
    - the override applies only to `stageDiscovery` (`provider.ts` 504-508), and every other kind keeps 524,288 bytes (test `football-data-probe.test.ts` 445-446).
- **Mitigation:** T61 records the largest decoded stage-discovery body and any `too_large` refusal (condition C8). T62 then confirms the value or lowers it. Any value above 2 MiB needs a new review (Q8).

### T60-F05: the marker scan does not compare the real `X-Authenticated-Client` value (LOW, residual, non-blocking, class 1)

- **Component:** `security-checks.mjs` 862-868 (needles: the synthetic marker token, the synthetic client marker, and the real token when set).
- **Description:** For T61, the real-value backstop covers only the token. Whether the real client identifier (the Product Owner's account, T11H-F04) is absent from the outputs rests on code and tests:
  - the value is read only into memory (`provider.ts` 779-787, 814-817);
  - only booleans are observed (`authenticatedClientPresent`, `authenticatedClientSameAsFirst`, `classifiedPositive`);
  - the `Recorder` renders only the presence booleans (`football-data-probe.ts` 454-467, 961-964);
  - tests plant the marker-shaped client value on 200, 403, redirect and oversize replies and assert its absence from findings, stdout, stderr and process output (`football-data-probe.test.ts` 133-139, 383-404; `diagnostics.test.ts` 45-63).

  T59 did not change this path, except that FU-5 (`ANONYMOUS_CLIENT_MARKER = 'anonymous'`, compared in memory, `constants.ts` 37) makes the classification stricter.
- **Mitigation (optional):** none is required for T61. If the Product Owner wants a positive control, they may search the findings file for their own account identifier themselves. The Orchestrator must not handle that value.

### T60-F06: the diagnostic path relies on the absence of record-keyed schemas (LOW, maintenance guard, non-blocking, class 1)

- **Component:** `observation.ts` `INDEX` (295), `diagnosticPath` (367-378), `DIAGNOSTIC_FIELD_NAMES` (351-360).
- **Description:**
  - Zod issue paths hold only object keys and array positions. They hold data only where a schema keys by input (record or map). No schema in the diagnostic set uses `z.record`, `z.map`, `catchall`, `looseObject` or `passthrough`: a search of `schemas.ts` and `packages/contracts/src` finds `looseObject` only in HTTP schemas outside the set.
  - Two shapes would pass `diagnosticPath` if such a schema were added: a numeric record key of up to 5 digits (it matches `INDEX`) and a record key equal to a declared field name.
- **Mitigation:** whoever adds a record-keyed schema to `DIAGNOSTIC_FIELD_NAMES`'s inputs must re-review the reduction (for example by keeping digits only where the schema position is an array). No change is needed now.

## 5. Answers to the five questions

### Q1. Can the failing path, refusal kind, rejecting stage or resource kind carry a value into the findings, stdout or stderr?

**No.**

- **Path origin:**
  - The allow-list path is `result.issues[0].path` from `parseDomain` (`provider.ts` 666-673). `formatIssuePath` builds it from Zod's `issue.path`, which holds keys and indices only, never input values (`parse.ts` 26-31, 68-79).
  - The domain path is `SourceError.path` from the shared validation: the first Zod issue path, or a constant `/items/<index>/<field>`, `/sourceId` or `/mode` (`validation.ts` 36-41, 66-74, 117-130).
  - Raw paths never leave the adapter towards the observer: the adapter reduces them in `#observeRejection` before emitting (`provider.ts` 742-747).
- **Reduction (`observation.ts` 293-378):**
  - A segment survives only if it is a numeric index `^(0|[1-9][0-9]{0,4})$` or a member of `DIAGNOSTIC_FIELD_NAMES`. Every other segment becomes `*`.
  - `DIAGNOSTIC_FIELD_NAMES` holds only the object-shape keys declared by the four adapter allow-list schemas and the four shared domain schemas, collected from `def.shape` keys matching `^[A-Za-z_][A-Za-z0-9_]{0,63}$`. Enum and literal values are not collected.
  - A non-string, a path not starting with `/`, or a path over 200 characters is `null` ("not recorded"). At most 24 segments are kept.
  - `~1`-escaped slashes stay inside one segment, so a URL-shaped key becomes a single `*`.
  - Tests check the reduction and its idempotence (`diagnostics.test.ts` 94-169): planted tokens, client markers, URLs, accented team names, enum values, `__proto__` and over-long paths.
- **Reduction applied twice:** in the adapter (`provider.ts` 746), and again in the probe:
  - at `Recorder.observe` (`football-data-probe.ts` 413);
  - in `diagnosticText` (305), so a forged diagnostic object is also reduced (test 509-543).
- **Refusal kind:** `egressRefusalKind` maps the `EgressError.kind` to `too_large`, `redirect`, `other` or `null`. The error message (which may hold a URL) is never read (`observation.ts` 277-290). The probe re-closes the value with `closedRefusal` (284).
- **Rejecting stage and resource kind:** both are constants at the call sites (`provider.ts` 663, 673, 282, 312, 350, 394). The probe re-checks them against closed sets (`closedStage`, `closedResource`, 279-289). An unknown value drops the observation or renders "no diagnostic recorded".
- **Failure counts per resource kind:** the text is built from a numeric status or the closed `SourceError` code (`failure.code`, `provider.ts` 541), the closed refusal and the closed resource (`football-data-probe.ts` 428-436).
- **Console:** the progress lines hold fixed text and counts only (581, 593, 615, 675, 680, 725, 745-747). Failures print one closed line (157-159, 751, 1036-1041), never an error object or stack. The tests check every stdout line against `^probe: [a-z ,;:0-9]+$` and spy on the real process streams and the console (`football-data-probe.test.ts` 47, 74-93, 434).
- **T10 logging controls:** the adapter's debug logs of the raw path (`provider.ts` 669-671, `validation.ts` 53-56) predate T59 and hold keys and indices only, since no schema in the set is record-keyed (T60-F06). The probe uses `silentSportsLogger`. Provider error bodies of non-2xx responses are never read (`provider.ts` 610-627).

### Q2. Does `--candidates` accept only closed competition codes, keep the 30-request cap and the budget, and echo only operator input of the code shape?

**Yes.**

- **Shape and parsing:** see T60-F02. The option may be given once; a second occurrence is a `config` failure (208-212).
- **Cap and budget:**
  - Every request passes `countingEgress` (241-252), which refuses request 31 and later before the transport, including adapter retries and the 429 retry, since the registry is built on the counting client (661).
  - Details are limited to the references plus the named codes, sliced to 12 (707-715).
  - Coverage is limited to the references plus the first 5 readable named candidates (727-736), and every step checks `remaining` (572, 587, 600, 613, 717).
  - The request budget (`requestsPerMinute` 10, reserved slots) comes from the unchanged configuration.
  - Test 602-616 shows exactly 30 requests with 12 named codes.
- **No request for an unlisted code:** a code not in the listing costs no request (695, 711-714; tests 547-581, including the exact T61 command shape).

### Q3 (a). Can the "Dropped keys" line print a token-shaped key name, and is that acceptable for the run?

Yes, a token-shaped key name can be printed (T60-F01), and it is acceptable for T61. The key is printed whole, so the `--require-token` exact scan catches the real token. T61 does not commit on a scan failure, and condition C7 adds a read of these lines. I recommend hardening this in a later task.

### Q3 (b). Is echoing unlisted candidate codes acceptable?

Yes. Only operator text of the code shape (16 characters at most) is echoed, and it cannot hold a token, a URL or a value with a separator (T60-F02).

### Q4. Is the `stageDiscovery` 1 MiB limit within the reviewed bound?

**Yes.**

- 1,048,576 bytes is at most 2,097,152 bytes.
- The bound is enforced by the option schema and by the egress client.
- The limit applies only to stage discovery; every other kind keeps 512 KiB.
- Oversize bodies are refused as `too_large` without being read further, and the refusal is recorded by kind only.
- The test checks the bound (`live-config.test.ts` 95-102), and the oversize planted reply uses that cap (`football-data-probe.test.ts` 396-404, 445).
- The value is prospective rather than measured; T61 measures it (T60-F04).

### Q5. Is the `--require-token` marker scan still a sufficient backstop for T61?

**Yes, under conditions C1 to C8.**

- **What the scan does:**
  - It exits 1 when the token is absent and `--require-token` is given (849-855).
  - It compares the exact bytes of the real token in every regular file under the given paths (862-895).
  - A file above 20 MiB is a finding, not a skip (164-165).
  - It prints `real token checked: yes|no` (899).
- **Why exact matching is enough here:**
  - No code path transforms the token into output: it is a non-enumerable member of a frozen environment object, deleted from `process.env` (`football-data-probe.ts` 228-238). It is sent only as a header to the pinned origin.
  - The findings hold only closed values, counts, documented field names, provider catalogue names, and dropped key names printed whole.
  - The only provider-controlled text that `cell` truncates (competition, area and stage names; 120 characters) passes the shared display-name and stage schemas first. A partial token there would need the provider to embed the token in a catalogue name, which is outside a realistic threat for this run.
- **What the scan does not cover:**
  - the real `X-Authenticated-Client` value (T60-F05, covered by code and tests);
  - the build output that `npm run probe:football-data` prints first (`package.json` 29). The build runs before the token is read and holds no token.

## 6. Conditions for T61

| ID | Condition |
|---|---|
| C1 | **Reviewed code only.** In the T61 worktree, these paths are unchanged from `3313782` (for example, `git diff --stat 3313782 -- <paths>` prints nothing): `apps/server/scripts/football-data-probe.ts`, the non-test files of `apps/server/src/providers/sports/adapters/football-data/`, `apps/server/src/providers/sports/ingestion/validation.ts`, `packages/contracts/src/domain/parse.ts`, `apps/server/src/platform/net/egress-client.ts`, `scripts/security-checks.mjs`, `config/live.config.json` and the root `package.json` probe script. Any change to them is re-reviewed before the run. |
| C2 | **Command as scoped.** Run `npm run probe:football-data -- --candidates CL,ELC,PD,BL1,SA,FL1 --out docs/work-items/WI-1/research/football-data-capabilities-2.md`. Do not pass `--config`. Redirect both streams of the whole npm command to the git-ignored log: `> .cache/probe-output.log 2>&1` (`.gitignore` 8, 11 ignore `/.cache` and `.env*`). Do not let probe output reach the terminal transcript. |
| C3 | **Scan before any read, with the token loaded.** For example: `node --env-file=.env.local scripts/security-checks.mjs marker-scan --require-token docs/work-items/WI-1/research .cache/probe-output.log`, with its output written to a temporary file outside the repository. The scan passes only if: exit is 0; the output contains `real token checked: yes`; there is no finding line; and `files scanned` counts both the new findings file and the log (at least the number of files in `research/` plus 1). |
| C4 | **Token presence by count only.** Use `grep -c '^FOOTBALL_DATA_API_TOKEN=..*' .env.local`. Do not use a read tool, `cat`, `env`, `printenv` or shell tracing. The console log is never read. Delete `.env.local` and the log after the scan. Record the scan output with `orch evidence write` as `T61-marker-scan-real.txt`. |
| C5 | **On any scan failure,** do not commit the findings file, delete it with the log, and report a possible credential exposure to the Product Owner (as T61 scope states). |
| C6 | **Single run.** At most one probe run within the 30-request cap. A second run in T61 needs the Product Owner again (PD-24). |
| C7 | **Post-scan read of the new outputs.** After a passing scan and before committing, the Orchestrator reads the "Dropped keys" lines and every diagnostic line. Do not commit if a dropped key is not a recognisable provider field name (for example a long random-looking hexadecimal or alphanumeric string). Do not commit if a diagnostic line differs from the five reviewed formats: `egress refusal <too_large\|redirect\|other> on <resource>`; `body not JSON on <resource>`; `allow-list schema on <resource>, path <P\|not recorded>`; `domain validation on <resource>, path <P\|not recorded>`; `no diagnostic recorded`. Report either case to the Product Owner as in C5. |
| C8 | **Size evidence for the 1 MiB cap.** T61's record keeps the largest decoded stage-discovery body and any `too_large` refusal on `stageDiscovery`, from the findings "Response sizes" and "Failures by resource kind" lines, so that T62 can confirm or lower the value (T60-F04). |

## 7. Contract Safety, closed-state review and NOT VERIFIED items

- **Contract Safety:** not applicable. T59 changes no interface contract or data schema. `maxResponseBytesByResource` was already in `contracts/provider-ports.md` section 1.4 (A1.3), and T59 only sets its committed value.
- **Closed-state review:** not applicable. No closures entry is added, removed or altered, and the evaluation of trackers, evidence or closed work items is unchanged.
- **NOT VERIFIED items:** none required for this verdict. The test results come from the evidence pack (`evidence/T59-gates.txt`, PRJ-UNIT and PRJ-INTEGRATION PASS at `7845e6f`); I read the tests and did not run them. The real-token properties of T61 (C3, C4) are verified by T61's own evidence (`T61-marker-scan-real.txt`), not here.

## 8. Residual risks

- **R-a (T60-F01):** a provider-chosen key name is printed if it matches the identifier shape. The real-token scan and the C7 read cover this for T61; hardening is recommended.
- **R-b (T60-F05):** the real client identifier is not covered by an automated scan; it is covered by code and tests.
- **R-c (T60-F04):** the 1 MiB value is not yet measured against a domestic league.
- **R-d:** provider catalogue values (competition names, area names, stage values, season labels) are still written to the findings by design (T49, T53). They are not team names or scores, are validated by shared schemas, and are scanned for the token.
- **R-e (T60-F06):** the path reduction depends on the absence of record-keyed schemas in the diagnostic set.
- **Data handling:** only the Product Owner's own free-plan token is used, under PD-16 and PD-24. This review does not approve any other real personal or sensitive data.

## 9. Verdict

The diagnostics of T59 cannot carry a team name, score, header value, URL, token or provider text to the findings file, stdout or stderr:

- every new field is a closed value or a path reduced to declared schema field names, indices and `*`;
- the reduction is applied in the adapter and again in the probe;
- `--candidates` accepts only code-shaped operator input and keeps the 30-request cap;
- the 1 MiB stage-discovery cap is within the reviewed 2 MiB bound.

The findings are LOW or INFO and none blocks. The T61 run may proceed under conditions C1 to C8.

Verdict: PASS
