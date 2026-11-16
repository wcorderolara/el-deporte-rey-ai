-- PD-ARCH-01H: editorial copy of a project (Facebook/Instagram, TikTok/Reels, three viral headlines, YouTube and a
-- debate question), written from the confirmed sports context of the project's draft.
--
-- editorial_generations records every request to the editorial writer, successful or not: the writer, model, prompt
-- version, research mode, the editorial context it was given (confirmed matches, round state, key events and
-- evidence, as one JSON snapshot), the operator's instruction, the usage the provider reported and the estimated and
-- computed cost. A hosted writer is billed (PD-30): the daily count and the monthly spend are computed from these
-- rows. request_key is the client's idempotency key.
--
-- editorial_versions holds the versions of each deliverable of a draft, never deleted (OD-08): the final fields, the
-- writer's raw text with its placeholders (null for an operator edit), the content flags, and the fact, event and
-- evidence identifiers the version rests on. A new version supersedes the current one (an approved version keeps
-- approved_at as its history); an approval is bound to the exact version, and withdrawing it clears approved_at.
-- Projects, drafts, carousels and exports are not changed.
CREATE TABLE editorial_generations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  draft_id TEXT NOT NULL REFERENCES content_drafts (id) ON DELETE RESTRICT,
  request_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  deliverables TEXT NOT NULL CHECK (json_valid(deliverables)),
  instructions TEXT NULL CHECK (instructions IS NULL OR length(instructions) BETWEEN 1 AND 500),
  adapter TEXT NOT NULL CHECK (length(adapter) BETWEEN 1 AND 41),
  writer_kind TEXT NOT NULL CHECK (writer_kind IN ('test', 'hosted_ai', 'local_ai')),
  model TEXT NULL CHECK (model IS NULL OR length(model) BETWEEN 1 AND 100),
  prompt_version TEXT NOT NULL CHECK (length(prompt_version) BETWEEN 1 AND 60),
  research_mode TEXT NOT NULL CHECK (research_mode IN ('local_context', 'verified_research')),
  context TEXT NOT NULL CHECK (json_valid(context)),
  billed INTEGER NOT NULL CHECK (billed IN (0, 1)),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  error_code TEXT NULL CHECK (
    error_code IS NULL OR error_code IN ('unavailable', 'rate_limited', 'timeout', 'ai_response_invalid', 'interrupted')
  ),
  input_tokens INTEGER NULL CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER NULL CHECK (output_tokens IS NULL OR output_tokens >= 0),
  estimated_cost REAL NULL CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  computed_cost REAL NULL CHECK (computed_cost IS NULL OR computed_cost >= 0),
  created_at TEXT NOT NULL,
  completed_at TEXT NULL,
  CHECK ((status = 'failed') = (error_code IS NOT NULL)),
  CHECK ((status = 'running') = (completed_at IS NULL))
) STRICT;

CREATE INDEX editorial_generations_by_project ON editorial_generations (project_id, created_at DESC, id DESC);
CREATE INDEX editorial_generations_by_time ON editorial_generations (created_at);

CREATE TABLE editorial_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  draft_id TEXT NOT NULL REFERENCES content_drafts (id) ON DELETE RESTRICT,
  deliverable TEXT NOT NULL CHECK (
    deliverable IN ('facebook_instagram', 'tiktok_reels', 'viral_headlines', 'youtube', 'debate_question')
  ),
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  origin TEXT NOT NULL CHECK (origin IN ('generated', 'regenerated', 'edited')),
  generation_id TEXT NULL REFERENCES editorial_generations (id) ON DELETE RESTRICT,
  base_version_id TEXT NULL REFERENCES editorial_versions (id) ON DELETE RESTRICT,
  instructions TEXT NULL CHECK (instructions IS NULL OR length(instructions) BETWEEN 1 AND 500),
  raw TEXT NULL CHECK (raw IS NULL OR json_valid(raw)),
  fields TEXT NOT NULL CHECK (json_valid(fields)),
  flags TEXT NOT NULL CHECK (json_valid(flags)),
  fact_ids TEXT NOT NULL CHECK (json_valid(fact_ids)),
  event_ids TEXT NOT NULL CHECK (json_valid(event_ids)),
  evidence_ids TEXT NOT NULL CHECK (json_valid(evidence_ids)),
  created_at TEXT NOT NULL,
  approved_at TEXT NULL,
  superseded_at TEXT NULL,
  UNIQUE (draft_id, deliverable, version_number),
  CHECK ((origin = 'edited') = (generation_id IS NULL))
) STRICT;

CREATE INDEX editorial_versions_by_draft ON editorial_versions (draft_id, deliverable, version_number DESC);
