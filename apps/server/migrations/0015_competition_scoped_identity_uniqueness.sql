-- Identities belong to their local competition (ADR-01D-04, ADR-01D-07): within one competition scope a local
-- record carries at most one identity per provider resource, so two external teams never merge into one, while the
-- same global Team can be linked again, explicitly, in another competition. Replaces the unscoped index of 0014.
DROP INDEX uq_external_identity_local;
CREATE UNIQUE INDEX uq_external_identity_local
  ON external_identity_mappings (provider_key, resource, scope_key, local_id);
