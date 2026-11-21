CREATE TYPE "EvaluationOrigin" AS ENUM ('UNKNOWN', 'INDEPENDENT', 'PUBLISHER');

ALTER TABLE "BenchmarkResult"
  ADD COLUMN "evaluationOrigin" "EvaluationOrigin" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "datasetRevision" TEXT,
  ADD COLUMN "evaluationConfig" TEXT,
  ADD COLUMN "publishedAt" DATE,
  ADD COLUMN "observedAt" TIMESTAMPTZ(3);

UPDATE "BenchmarkResult"
SET "evaluationOrigin" = 'PUBLISHER'
WHERE "sourceId" = 'openai' AND "evaluationKey" = 'gpt-4-1-launch-2025-04-14';
