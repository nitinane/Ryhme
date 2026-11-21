ALTER TABLE "Offering"
  ALTER COLUMN "observedAt" TYPE timestamptz(3) USING "observedAt"::timestamp AT TIME ZONE 'UTC';

ALTER TABLE "Offering" ADD COLUMN "catalogMissingSince" timestamptz(3);

ALTER TABLE "PriceObservation"
  ALTER COLUMN "observedAt" TYPE timestamptz(3) USING "observedAt"::timestamp AT TIME ZONE 'UTC';

ALTER TABLE "DataSource" ADD COLUMN "catalogSyncedAt" timestamptz(3);
