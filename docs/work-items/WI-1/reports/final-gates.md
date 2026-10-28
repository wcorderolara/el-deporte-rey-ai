# WI-1 final gates and security verdict

- Work item: WI-1, branch `work/WI-1`; final gates validated at `754fe2df6073e88a5da7cc4bc0510798795b2a5f` (verify worktree, committed and clean, no `FOOTBALL_DATA_API_TOKEN` in the environment); date 2026-10-28.
- First run: `evidence/T48-gates.txt` at 74843ca, 14 PASS, 1 FAIL (FW-AC: superseded criteria R-201, R-210, R-239 counted without regard to status); handled by OD-67; kept as evidence.
- Final run: `evidence/T48-gates-2.txt`, RESULT PASS, 15 PASS, 0 FAIL, 0 NOT RUN.

| Gate | Result | Detail |
|------|--------|--------|
| FW-TRACKER | PASS | tracker check |
| FW-CONFIG | PASS | config, policy, agents, models |
| FW-SECURITY | PASS | latest security-reviewer VERIFY evidence with RESULT PASS |
| FW-AC | PASS | 92 acceptance criteria named by DONE tasks (89 active; 3 superseded named as such, OD-67) |
| PRJ-INSTALL | PASS | npm ci |
| PRJ-TYPECHECK | PASS | npm run typecheck |
| PRJ-LINT | PASS | npm run lint |
| PRJ-UNIT | PASS | 116 files, 2140 tests |
| PRJ-INTEGRATION | PASS | 39 files, 511 tests |
| PRJ-CONTRACT | PASS | 7 files, 779 tests |
| PRJ-CONTRACT-ID | PASS | http-api 1.0.0 matches the recorded hash |
| PRJ-BUILD | PASS | build |
| PRJ-E2E | PASS | 13 journeys |
| PRJ-A11Y | PASS | 18 tests, no serious or critical violation |
| PRJ-AUDIT | PASS | no high or critical advisory; 2 moderate (GHSA-px8p-9vwx-vf98, accepted by OD-33) |

## Security verdict

- T47 security delta validation: `security/T47-security-validation.md`, `Verdict: PASS`, evidence `evidence/T47-security-validation.txt` (RESULT PASS); evidence pack T46 (27 files, all PASS); real-token scans `evidence/T53-marker-scan-real.txt` and `evidence/T61-marker-scan-real.txt` (`real token checked: yes`, 0 findings).
- Open findings: none CRITICAL, HIGH or MEDIUM. LOW: T47-F01 (T61 `.env.local` 0644 before being set to 0600 during the run; Product Owner to confirm no other OS account or rotate the token), T47-F02 (T53 procedure deviations, no exposure), T47-F05 (image decode memory under concurrent uploads, acceptable under PD-16); T47-F03 closed (registry-signatures evidence checked); INFO: T47-F04, F06, F07. Deferred hardening: T60-F01, F03, F06 (next work item).
- Note: the FW-SECURITY gate reads the latest DONE security-reviewer VERIFY task in tracker order, which is T60 (probe diagnostics review, PASS); the work item's security delta validation is T47 (PASS).
