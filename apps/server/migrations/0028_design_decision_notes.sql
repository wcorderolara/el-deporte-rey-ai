-- PD-ARCH-01G-B refinement: longer review notes. Additive only.
--
-- The note of a review decision ("Qué debe cambiar") becomes the instructions of the variant it asks for, and 500
-- characters fell short for a precise change request. SQLite cannot widen a CHECK without rebuilding a table that other
-- tables reference, so notes of up to 1200 characters go to `decision_note_text` and `note_text`; the old columns stay
-- for the rows already stored and are read when the new ones are empty.
ALTER TABLE design_proposals ADD COLUMN decision_note_text TEXT NULL
  CHECK (decision_note_text IS NULL OR length(decision_note_text) BETWEEN 1 AND 1200);
ALTER TABLE design_proposal_decisions ADD COLUMN note_text TEXT NULL
  CHECK (note_text IS NULL OR length(note_text) BETWEEN 1 AND 1200);
