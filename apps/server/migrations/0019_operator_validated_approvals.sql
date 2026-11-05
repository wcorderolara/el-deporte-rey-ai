-- PD-ARCH-01E-PD-01: the Product Owner decided that locally managed sports data (manual, imported from a provider or
-- hybrid) is validated by the operator before content is generated. When a run verifies the facts of an
-- operator-validated MANUAL_DATA source, their manual approval is recorded automatically with this origin, so it stays
-- distinguishable from an approval given fact by fact. Existing approvals keep the origin `operator`.
ALTER TABLE manual_approvals
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'operator' CHECK (origin IN ('operator', 'operator_validated_source'));
