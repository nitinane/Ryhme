-- Execute only as the owner of the approved development database.
-- Create ryhme_catalog_sync as a non-owner LOGIN using the private credential flow first.
GRANT CONNECT ON DATABASE neondb TO ryhme_catalog_sync;
GRANT USAGE ON SCHEMA public TO ryhme_catalog_sync;
GRANT SELECT, INSERT ON "DataSource", "Provider", "Lab", "ModelFamily", "ModelVersion",
  "Offering", "PriceObservation", "SourceObservation" TO ryhme_catalog_sync;
GRANT UPDATE ("catalogSyncedAt") ON "DataSource" TO ryhme_catalog_sync;
GRANT UPDATE ("canonicalName", "contextTokens", "modalities", "capabilities", "updatedAt")
  ON "ModelVersion" TO ryhme_catalog_sync;
GRANT UPDATE ("observedAt", "catalogMissingSince", "availabilityStatus", "contextOverride")
  ON "Offering" TO ryhme_catalog_sync;
