# Bootstrap report

Created by `orch init` for framework version 3.0.0. Detection is read-only. The facts below are file and directory names, catalogue tool names, fixed script names and counts; no file content or setting value is copied.

## Repository

- Git repository: yes
- Current branch: `main` (unborn: no commit yet)
- Default branch: `main` (basis: assumed) - assumed, please confirm
- Working tree: clean
- Worktrees: 1

## Detected stacks

No stack was recognized. Nothing is assumed; gates for a stack are added when the project has one.

## Other indicators

- CI: none
- Containers: none
- Database indicators: none
- User interface: not detected
- Interface contracts: none
- Workspaces: none

## Documentation and conventions

- No documentation files recognized.
- Existing agent instruction files: none
- Existing agent definitions: none
- Commit style: undetermined (no commits) (0 commit(s) sampled)
- Branch prefixes: none
- Work-item ID pattern proposal: none found

## Agent roles

| Role | Enabled | Reason |
|------|---------|--------|
| product-manager | yes | core role |
| architect | yes | core role |
| backend-developer | yes | implementation role; stack undetermined |
| frontend-developer | no | no user interface detected |
| qa-engineer | yes | core role |
| security-reviewer | yes | core role |

## Gates

| ID | Category | Required | Status | Command | Origin |
|----|----------|----------|--------|---------|--------|
| FW-TRACKER | framework | yes | configured | builtin tracker | framework |
| FW-CONFIG | framework | yes | configured | builtin config | framework |
| FW-SECURITY | framework | yes | configured | builtin security-verdict | framework |
| FW-AC | framework | yes | configured | builtin ac-coverage | framework |

## Configuration required before final gates

None: every derived gate has a command.

## Undetermined

- stack

## Next steps

- Review the configuration, gates, roles and paths; the configuration is the adopter's to adjust (it may tighten the policy floor, never loosen it).
- Init made no commit. Commit the created files when you are ready.
