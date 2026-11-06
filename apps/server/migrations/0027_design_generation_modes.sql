-- PD-ARCH-01G-B refinement: two generation modes and long operator prompts. Additive only.
--
-- `mode` is `guided` (the server's versioned prompt: a background design with empty data zones, no text and no people,
-- that a structured template can reuse) or `own_prompt` (the operator's prompt sent as written, with only the numbering
-- of the input images and the zones of the original layers added; an inspiration image, never a template base). Rows
-- before this migration are guided.
--
-- Operator prompts of up to 12000 characters were cut at the 2000 of `instructions` (and 4000 of
-- `inherited_instructions`). SQLite cannot widen a CHECK without rebuilding a table that other tables reference, so the
-- text of new generations goes to `instructions_text` and `inherited_text`; the old columns stay for the rows already
-- stored and are read when the new ones are empty.
ALTER TABLE design_generations ADD COLUMN mode TEXT NOT NULL DEFAULT 'guided' CHECK (mode IN ('guided', 'own_prompt'));
ALTER TABLE design_generations ADD COLUMN instructions_text TEXT NULL
  CHECK (instructions_text IS NULL OR length(instructions_text) BETWEEN 1 AND 12000);
ALTER TABLE design_generations ADD COLUMN inherited_text TEXT NULL
  CHECK (inherited_text IS NULL OR length(inherited_text) BETWEEN 1 AND 12000);
