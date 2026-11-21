-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Lifecycle" AS ENUM ('ACTIVE', 'DEPRECATED', 'RETIRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'CONFLICTED');

-- CreateEnum
CREATE TYPE "ScoreDirection" AS ENUM ('HIGHER', 'LOWER');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('LISTED', 'UNAVAILABLE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelFamily" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "labId" TEXT NOT NULL,

    CONSTRAINT "ModelFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "releaseDate" DATE,
    "lifecycle" "Lifecycle" NOT NULL DEFAULT 'UNKNOWN',
    "contextTokens" INTEGER,
    "modalities" JSONB,
    "capabilities" JSONB,
    "license" TEXT,
    "openWeights" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "externalModelId" TEXT NOT NULL,
    "availabilityStatus" "Availability" NOT NULL DEFAULT 'UNKNOWN',
    "contextOverride" INTEGER,
    "observedAt" DATE NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceObservation" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "inputPerMillion" DECIMAL(18,8),
    "outputPerMillion" DECIMAL(18,8),
    "observedAt" DATE NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" "ScoreDirection" NOT NULL,
    "methodology" TEXT NOT NULL,
    "version" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkResult" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "score" DECIMAL(18,8) NOT NULL,
    "evaluatedAt" DATE,
    "methodologyVersion" TEXT,
    "evaluationKey" TEXT NOT NULL,
    "verifiedStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,

    CONSTRAINT "BenchmarkResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "homepage" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "trustPolicy" TEXT NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceObservation" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "observedAt" DATE NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL,
    "rawChecksum" TEXT,

    CONSTRAINT "SourceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelFamily_slug_key" ON "ModelFamily"("slug");

-- CreateIndex
CREATE INDEX "ModelFamily_labId_idx" ON "ModelFamily"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_slug_key" ON "ModelVersion"("slug");

-- CreateIndex
CREATE INDEX "ModelVersion_familyId_lifecycle_idx" ON "ModelVersion"("familyId", "lifecycle");

-- CreateIndex
CREATE INDEX "ModelVersion_contextTokens_idx" ON "ModelVersion"("contextTokens");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE INDEX "Offering_modelVersionId_idx" ON "Offering"("modelVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Offering_providerId_externalModelId_key" ON "Offering"("providerId", "externalModelId");

-- CreateIndex
CREATE INDEX "PriceObservation_offeringId_observedAt_idx" ON "PriceObservation"("offeringId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceObservation_offeringId_sourceId_currency_observedAt_key" ON "PriceObservation"("offeringId", "sourceId", "currency", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_slug_key" ON "Benchmark"("slug");

-- CreateIndex
CREATE INDEX "Benchmark_category_idx" ON "Benchmark"("category");

-- CreateIndex
CREATE INDEX "BenchmarkResult_benchmarkId_score_idx" ON "BenchmarkResult"("benchmarkId", "score");

-- CreateIndex
CREATE INDEX "BenchmarkResult_modelVersionId_idx" ON "BenchmarkResult"("modelVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkResult_benchmarkId_modelVersionId_sourceId_evaluat_key" ON "BenchmarkResult"("benchmarkId", "modelVersionId", "sourceId", "evaluationKey");

-- CreateIndex
CREATE INDEX "SourceObservation_entityType_entityId_idx" ON "SourceObservation"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceObservation_sourceId_entityType_entityId_field_source_key" ON "SourceObservation"("sourceId", "entityType", "entityId", "field", "sourceUrl", "observedAt");

-- AddForeignKey
ALTER TABLE "ModelFamily" ADD CONSTRAINT "ModelFamily_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ModelFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_benchmarkId_fkey" FOREIGN KEY ("benchmarkId") REFERENCES "Benchmark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObservation" ADD CONSTRAINT "SourceObservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_contextTokens_check" CHECK ("contextTokens" > 0);
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_contextOverride_check" CHECK ("contextOverride" > 0);
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_nonnegative_prices_check" CHECK ("inputPerMillion" >= 0 AND "outputPerMillion" >= 0);
