BEGIN;

CREATE INDEX "ModelVersion_search_idx" ON "ModelVersion" USING GIN (
  to_tsvector('simple'::regconfig, regexp_replace("canonicalName" || ' ' || "slug", '[^[:alnum:]]+', ' ', 'g'))
);

CREATE INDEX "ModelVersion_capabilities_idx" ON "ModelVersion" USING GIN ("capabilities" jsonb_path_ops);
CREATE INDEX "ModelVersion_modalities_idx" ON "ModelVersion" USING GIN ("modalities" jsonb_path_ops);
CREATE INDEX "ModelVersion_lifecycle_idx" ON "ModelVersion" ("lifecycle");
CREATE INDEX "ModelVersion_openWeights_idx" ON "ModelVersion" ("openWeights");
CREATE INDEX "ModelVersion_license_idx" ON "ModelVersion" ("license");
CREATE INDEX "Offering_provider_model_idx" ON "Offering" ("providerId", "modelVersionId");
CREATE INDEX "PriceObservation_latest_currency_idx" ON "PriceObservation" ("offeringId", "currency", "observedAt" DESC, "id" DESC);

COMMIT;
