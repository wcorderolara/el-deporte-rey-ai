-- PD-ARCH-01G-B: AI design proposals. Additive only; no existing table changes.
--
-- design_generations is one confirmed request to the image provider: what was asked (content type, format, style,
-- instructions, quality, count), the model and size used, the versioned prompt actually sent, the brand assets used
-- with their role and the policy they had, the cost estimate shown before confirmation, the reported token usage and
-- the computed cost, and the status the server recorded. `request_key` makes a repeated confirmation return the same
-- generation. A variant references the proposal it starts from.
--
-- design_generation_events is the append-only log streamed to the browser (the convention of the import
-- operations); design_proposals holds one generated image each (a file under `<dataDir>/design-proposals/`, never in
-- SQLite) with its review status; design_proposal_decisions keeps every review decision. Proposals are never
-- templates and never brand assets; nothing here is deleted.
CREATE TABLE design_generations (
  id TEXT PRIMARY KEY,
  request_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  parent_proposal_id TEXT NULL REFERENCES design_proposals (id) ON DELETE RESTRICT,
  content_type TEXT NOT NULL CHECK (content_type IN ('match_preview', 'round_overview', 'fixture', 'match_result')),
  format TEXT NOT NULL CHECK (format IN ('1:1', '4:5', '9:16')),
  style TEXT NULL CHECK (style IS NULL OR length(style) BETWEEN 1 AND 300),
  instructions TEXT NULL CHECK (instructions IS NULL OR length(instructions) BETWEEN 1 AND 2000),
  inherited_instructions TEXT NULL
    CHECK (inherited_instructions IS NULL OR length(inherited_instructions) BETWEEN 1 AND 4000),
  quality TEXT NOT NULL CHECK (length(quality) BETWEEN 1 AND 16),
  requested_count INTEGER NOT NULL CHECK (requested_count BETWEEN 1 AND 8),
  provider TEXT NOT NULL CHECK (length(provider) BETWEEN 1 AND 41),
  model TEXT NOT NULL CHECK (length(model) BETWEEN 1 AND 100),
  request_size TEXT NOT NULL CHECK (length(request_size) BETWEEN 3 AND 11),
  output_width INTEGER NOT NULL CHECK (output_width BETWEEN 1 AND 4096),
  output_height INTEGER NOT NULL CHECK (output_height BETWEEN 1 AND 4096),
  adaptation TEXT NOT NULL CHECK (adaptation IN ('none', 'center_crop')),
  prompt_version TEXT NOT NULL,
  prompt TEXT NOT NULL CHECK (length(prompt) BETWEEN 1 AND 32000),
  references_json TEXT NOT NULL CHECK (json_valid(references_json) AND json_type(references_json) = 'array'),
  estimate_json TEXT NOT NULL CHECK (json_valid(estimate_json) AND json_type(estimate_json) = 'object'),
  status TEXT NOT NULL CHECK (
    status IN ('queued', 'preparing_references', 'sending_request', 'generating', 'saving', 'completed', 'failed')
  ),
  current_index INTEGER NULL CHECK (current_index IS NULL OR current_index >= 1),
  completed_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  usage_json TEXT NOT NULL CHECK (json_valid(usage_json) AND json_type(usage_json) = 'object'),
  cost REAL NULL CHECK (cost IS NULL OR cost >= 0),
  error_code TEXT NULL,
  error_message TEXT NULL CHECK (error_message IS NULL OR length(error_message) <= 300),
  retry_after_seconds INTEGER NULL CHECK (retry_after_seconds IS NULL OR retry_after_seconds >= 0),
  created_at TEXT NOT NULL,
  started_at TEXT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT NULL
) STRICT;

CREATE INDEX idx_design_generations_created ON design_generations (created_at DESC);
CREATE INDEX idx_design_generations_parent ON design_generations (parent_proposal_id);

CREATE TABLE design_generation_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id TEXT NOT NULL REFERENCES design_generations (id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  image_index INTEGER NULL,
  proposal_id TEXT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_design_generation_events_generation ON design_generation_events (generation_id, sequence);

CREATE TABLE design_proposals (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL REFERENCES design_generations (id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  content_type TEXT NOT NULL CHECK (content_type IN ('match_preview', 'round_overview', 'fixture', 'match_result')),
  format TEXT NOT NULL CHECK (format IN ('1:1', '4:5', '9:16')),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 4096),
  mime TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg')),
  file_path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 1),
  usage_json TEXT NULL CHECK (usage_json IS NULL OR (json_valid(usage_json) AND json_type(usage_json) = 'object')),
  cost REAL NULL CHECK (cost IS NULL OR cost >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending_review', 'approved', 'rejected', 'changes_requested')),
  decision_note TEXT NULL CHECK (decision_note IS NULL OR length(decision_note) BETWEEN 1 AND 500),
  decided_at TEXT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (generation_id, sequence)
) STRICT;

CREATE INDEX idx_design_proposals_created ON design_proposals (created_at DESC);

CREATE TABLE design_proposal_decisions (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL REFERENCES design_proposals (id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  note TEXT NULL CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX idx_design_proposal_decisions_proposal ON design_proposal_decisions (proposal_id, sequence);
