-- PD-ARCH-01G-A: brand library and identity.
--
-- brand_assets gains the categories of the library (backgrounds and style references next to logos, the mascot and
-- graphic elements, `decoration`), WebP for style references only, the AI usage policy, the official and primary
-- marks, mascot variants, a description, the file size, the update time and a logical deletion (OD-08: rows and files
-- are never removed). SQLite cannot change a CHECK, so the table is rebuilt as 0008 did, keeping every row and ID; no
-- table references brand_assets.
--
-- Existing rows keep their behaviour: logos and the mascot become `protected` and graphic elements `reusable`
-- (`transformable` is never assigned), and the most recently registered active logo and mascot become the primary
-- ones, which is the asset the renderer has drawn so far. The file size is measured from the stored file at startup.
CREATE TABLE brand_assets_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('brand_logo', 'mascot', 'decoration', 'background', 'style_reference')),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  description TEXT NULL CHECK (description IS NULL OR length(description) BETWEEN 1 AND 500),
  mime TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
  file_path TEXT NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  byte_size INTEGER NULL CHECK (byte_size IS NULL OR byte_size BETWEEN 1 AND 5242880),
  usage_policy TEXT NOT NULL
    CHECK (usage_policy IN ('protected', 'reference_only', 'reusable', 'transformable')),
  official INTEGER NOT NULL CHECK (official IN (0, 1)),
  is_primary INTEGER NOT NULL CHECK (is_primary IN (0, 1)),
  variant TEXT NULL CHECK (variant IS NULL OR length(variant) BETWEEN 1 AND 80),
  pose TEXT NULL CHECK (pose IS NULL OR length(pose) BETWEEN 1 AND 80),
  expression TEXT NULL CHECK (expression IS NULL OR length(expression) BETWEEN 1 AND 80),
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  registered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deactivated_at TEXT NULL,
  deleted_at TEXT NULL,
  -- A style reference is never placed in content; WebP is accepted for style references only.
  CHECK (kind <> 'style_reference' OR usage_policy = 'reference_only'),
  CHECK (mime <> 'image/webp' OR kind = 'style_reference'),
  -- Pose and expression describe the mascot only.
  CHECK (kind = 'mascot' OR (pose IS NULL AND expression IS NULL)),
  -- The primary logo or mascot is active and drawable; a deleted asset is inactive and never primary.
  CHECK (is_primary = 0 OR (kind IN ('brand_logo', 'mascot') AND active = 1 AND usage_policy <> 'reference_only')),
  CHECK (deleted_at IS NULL OR (active = 0 AND is_primary = 0))
) STRICT;

INSERT INTO brand_assets_new
  (id, kind, label, description, mime, file_path, sha256, width, height, byte_size, usage_policy, official,
   is_primary, variant, pose, expression, active, registered_at, updated_at, deactivated_at, deleted_at)
SELECT
  a.id, a.kind, a.label, NULL, a.mime, a.file_path, a.sha256, a.width, a.height, NULL,
  CASE WHEN a.kind = 'decoration' THEN 'reusable' ELSE 'protected' END,
  0,
  CASE
    WHEN a.kind IN ('brand_logo', 'mascot') AND a.active = 1 AND a.rowid = (
      SELECT b.rowid FROM brand_assets b WHERE b.kind = a.kind AND b.active = 1
      ORDER BY b.registered_at DESC, b.rowid DESC LIMIT 1
    ) THEN 1
    ELSE 0
  END,
  NULL, NULL, NULL, a.active, a.registered_at, a.registered_at, a.deactivated_at, NULL
FROM brand_assets a
ORDER BY a.rowid;

DROP INDEX IF EXISTS idx_brand_assets_kind_active;
DROP TABLE brand_assets;
ALTER TABLE brand_assets_new RENAME TO brand_assets;

CREATE INDEX idx_brand_assets_kind_active ON brand_assets (kind, active);
-- At most one primary asset per kind.
CREATE UNIQUE INDEX idx_brand_assets_primary ON brand_assets (kind) WHERE is_primary = 1;

-- The identity of the brand: the descriptive fields the operator edits. The name, handle, palette and fonts stay in
-- the renderer's configuration (config/brand.json), the single source of those values. One row (`primary`) in this
-- release; the key leaves room for more identities.
CREATE TABLE brand_identity (
  id TEXT PRIMARY KEY CHECK (id = 'primary'),
  description TEXT NULL CHECK (description IS NULL OR length(description) BETWEEN 1 AND 1000),
  graphic_preferences TEXT NULL
    CHECK (graphic_preferences IS NULL OR length(graphic_preferences) BETWEEN 1 AND 2000),
  -- Usage note per colour role and per font role: JSON objects of role to text.
  color_usage TEXT NOT NULL CHECK (json_valid(color_usage) AND json_type(color_usage) = 'object'),
  typography_usage TEXT NOT NULL CHECK (json_valid(typography_usage) AND json_type(typography_usage) = 'object'),
  updated_at TEXT NULL
) STRICT;

INSERT INTO brand_identity (id, description, graphic_preferences, color_usage, typography_usage, updated_at)
VALUES ('primary', NULL, NULL, '{}', '{}', NULL);
