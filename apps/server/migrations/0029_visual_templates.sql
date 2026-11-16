-- PD-ARCH-01G-C: structured visual templates. Additive only; no existing table changes.
--
-- visual_templates is a reusable design made from an approved design proposal: its name, description, category,
-- content type and format, the proposal it came from and whether the operator acknowledged the warnings about that
-- background. Its status is derived: archived when `archived_at` is set, published when a version is published,
-- draft otherwise. `deleted_at` hides a template that was never published; the row is kept (OD-08).
--
-- visual_template_versions holds one version of a template: the canvas, the background (a design proposal or a brand
-- asset, pinned by its SHA-256; no file is copied), the layers as a JSON document validated by the server on every
-- write and read, and the brand assets the layers place, pinned by their hash. A published version is immutable: the
-- triggers refuse any update or delete of it. At most one draft exists per template; a discarded draft is kept.
CREATE TABLE visual_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description TEXT NULL CHECK (description IS NULL OR length(description) BETWEEN 1 AND 500),
  category TEXT NULL CHECK (category IS NULL OR length(category) BETWEEN 1 AND 80),
  content_type TEXT NOT NULL CHECK (content_type IN ('match_preview', 'round_overview', 'fixture', 'match_result')),
  format TEXT NOT NULL CHECK (format IN ('1:1', '4:5', '9:16')),
  source_proposal_id TEXT NULL REFERENCES design_proposals (id) ON DELETE RESTRICT,
  acknowledged_warnings INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged_warnings IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT NULL,
  deleted_at TEXT NULL
) STRICT;

CREATE INDEX idx_visual_templates_updated ON visual_templates (updated_at DESC);
CREATE INDEX idx_visual_templates_source ON visual_templates (source_proposal_id);

CREATE TABLE visual_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES visual_templates (id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'discarded')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  canvas_width INTEGER NOT NULL CHECK (canvas_width BETWEEN 1 AND 4096),
  canvas_height INTEGER NOT NULL CHECK (canvas_height BETWEEN 1 AND 4096),
  background_source TEXT NOT NULL CHECK (background_source IN ('design_proposal', 'brand_asset')),
  background_id TEXT NOT NULL CHECK (length(background_id) = 36),
  background_sha256 TEXT NOT NULL CHECK (length(background_sha256) = 64),
  background_mime TEXT NOT NULL CHECK (background_mime IN ('image/png', 'image/jpeg')),
  background_width INTEGER NOT NULL CHECK (background_width BETWEEN 1 AND 4096),
  background_height INTEGER NOT NULL CHECK (background_height BETWEEN 1 AND 4096),
  layers_json TEXT NOT NULL CHECK (json_valid(layers_json) AND json_type(layers_json) = 'array'),
  assets_json TEXT NOT NULL CHECK (json_valid(assets_json) AND json_type(assets_json) = 'array'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT NULL,
  CHECK ((status = 'published') = (published_at IS NOT NULL)),
  UNIQUE (template_id, version)
) STRICT;

CREATE UNIQUE INDEX idx_visual_template_versions_one_draft ON visual_template_versions (template_id)
  WHERE status = 'draft';
CREATE INDEX idx_visual_template_versions_background ON visual_template_versions (background_source, background_id);

CREATE TRIGGER trg_visual_template_version_published_update
BEFORE UPDATE ON visual_template_versions
WHEN OLD.status = 'published'
BEGIN
  SELECT RAISE(ABORT, 'a published visual template version is immutable');
END;

CREATE TRIGGER trg_visual_template_version_published_delete
BEFORE DELETE ON visual_template_versions
WHEN OLD.status = 'published'
BEGIN
  SELECT RAISE(ABORT, 'a published visual template version is immutable');
END;
