-- PD-ARCH-01F: logical project deletion. OD-08 keeps every row (history and traceability, R-043, R-044, R-220), so a
-- deleted project receives a tombstone timestamp instead of being removed: every read of the application excludes it,
-- its runs can no longer start, and its drafts, approvals, exports and files stay untouched on disk. Shared resources
-- (competitions, seasons, teams, rounds, matches, results, templates, brand assets, other projects) are not affected.
ALTER TABLE projects ADD COLUMN deleted_at TEXT NULL;
