-- Store provider-facing names in the binding snapshot without changing the original additive binding migration.
ALTER TABLE competition_provider_bindings
  ADD COLUMN provider_name TEXT NOT NULL DEFAULT 'Proveedor externo'
  CHECK (length(provider_name) BETWEEN 1 AND 80);

ALTER TABLE competition_provider_bindings
  ADD COLUMN external_competition_name TEXT NOT NULL DEFAULT 'Competición externa'
  CHECK (length(external_competition_name) BETWEEN 1 AND 80);

UPDATE competition_provider_bindings SET provider_name = provider_key;
