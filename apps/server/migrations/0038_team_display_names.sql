-- TEAM-DISPLAY-01 (PD-37): an optional presentation name per local team, set by the operator only and drawn in the
-- images of new projects instead of the official name. NULL means "none configured": the official name is used.
-- The official name, the identity keys (normalized_name, normalized_region), the competition and season links, the
-- badges, the results and every earlier project, snapshot and export are unchanged. A provider import never writes it.
--
-- An added nullable column: every existing team keeps its row and gets NULL.
ALTER TABLE managed_teams
  ADD COLUMN display_name TEXT NULL CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 32);
