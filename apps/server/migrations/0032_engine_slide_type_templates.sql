-- PD-ARCH-01G-D, Product Owner decision 01G-D-3: visual templates for the slide types of the engine's carousels, and
-- one template per slide type in a project.
--
-- visual_templates.content_type takes the six slide types the projects generate: cover, match_result, round_overview,
-- fixture, match_preview and closing (the four earlier values keep their meaning). SQLite cannot change a CHECK, so the
-- table is rebuilt under deferred foreign keys (see 0008): every row and index is kept, and visual_template_versions and
-- projects keep referencing it by name.
--
-- project_visual_templates records the exact published version a project uses for each slide type (a cover, the
-- match slides, a closing). It supersedes projects.visual_template_id and projects.visual_template_version_id, which
-- are moved into it and left null; SQLite cannot drop a column that is a foreign key. projects.badge_snapshot_json
-- stays: the badges are one record for the whole project.
PRAGMA defer_foreign_keys = ON;

-- The rows are kept aside, the table is dropped and created again under its own name, and the rows go back: each
-- reinsertion satisfies again the rows that reference it (a rename would leave the drop's deferred violations).
CREATE TEMP TABLE visual_templates_rows AS SELECT * FROM visual_templates;
DROP TABLE visual_templates;

CREATE TABLE visual_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  description TEXT NULL CHECK (description IS NULL OR length(description) BETWEEN 1 AND 500),
  category TEXT NULL CHECK (category IS NULL OR length(category) BETWEEN 1 AND 80),
  content_type TEXT NOT NULL CHECK (
    content_type IN ('cover', 'match_result', 'round_overview', 'fixture', 'match_preview', 'closing')
  ),
  format TEXT NOT NULL CHECK (format IN ('1:1', '4:5', '9:16')),
  source_proposal_id TEXT NULL REFERENCES design_proposals (id) ON DELETE RESTRICT,
  acknowledged_warnings INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged_warnings IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT NULL,
  deleted_at TEXT NULL
) STRICT;

INSERT INTO visual_templates
  (id, name, description, category, content_type, format, source_proposal_id, acknowledged_warnings, created_at,
  updated_at, archived_at, deleted_at)
SELECT id, name, description, category, content_type, format, source_proposal_id, acknowledged_warnings, created_at,
  updated_at, archived_at, deleted_at
FROM visual_templates_rows;
DROP TABLE visual_templates_rows;

CREATE INDEX idx_visual_templates_updated ON visual_templates (updated_at DESC);
CREATE INDEX idx_visual_templates_source ON visual_templates (source_proposal_id);

CREATE TABLE project_visual_templates (
  project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
  slide_type TEXT NOT NULL CHECK (
    slide_type IN ('cover', 'match_result', 'round_overview', 'fixture', 'match_preview', 'closing')
  ),
  visual_template_id TEXT NOT NULL REFERENCES visual_templates (id) ON DELETE RESTRICT,
  visual_template_version_id TEXT NOT NULL REFERENCES visual_template_versions (id) ON DELETE RESTRICT,
  PRIMARY KEY (project_id, slide_type)
) STRICT;

CREATE INDEX idx_project_visual_templates_template ON project_visual_templates (visual_template_id);

INSERT INTO project_visual_templates (project_id, slide_type, visual_template_id, visual_template_version_id)
SELECT p.id, t.content_type, p.visual_template_id, p.visual_template_version_id
FROM projects p
JOIN visual_templates t ON t.id = p.visual_template_id
WHERE p.visual_template_version_id IS NOT NULL;

UPDATE projects SET visual_template_id = NULL, visual_template_version_id = NULL WHERE visual_template_id IS NOT NULL;
