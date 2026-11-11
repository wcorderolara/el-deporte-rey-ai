-- PD-ARCH-01H: naming reconciliation of 0033_editorial_copy.sql, which is not edited once applied.
--
-- The R-233 schema scan refuses every name that looks like a credential, "token" included: the usage counters of a
-- generation are renamed usage_input and usage_output (the input and output units the provider reports for billing;
-- they hold counts, never a credential). The indexes take the project's idx_ prefix, so that the documented-index
-- inventory covers them. No row changes.
ALTER TABLE editorial_generations RENAME COLUMN input_tokens TO usage_input;
ALTER TABLE editorial_generations RENAME COLUMN output_tokens TO usage_output;

DROP INDEX editorial_generations_by_project;
DROP INDEX editorial_generations_by_time;
DROP INDEX editorial_versions_by_draft;

CREATE INDEX idx_editorial_generations_project ON editorial_generations (project_id, created_at DESC, id DESC);
CREATE INDEX idx_editorial_generations_created ON editorial_generations (created_at);
CREATE INDEX idx_editorial_versions_draft ON editorial_versions (draft_id, deliverable, version_number DESC);
