-- DropIndex
DROP INDEX "BenchmarkResult_benchmarkId_modelVersionId_sourceId_evaluat_key";

-- AlterTable
ALTER TABLE "BenchmarkResult" ADD COLUMN     "revision" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "supersededAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "DataSource" ADD COLUMN     "benchmarkSyncedAt" TIMESTAMPTZ(3),
ADD COLUMN     "catalogEtag" TEXT;

-- AlterTable
ALTER TABLE "Offering" ADD COLUMN     "outputTokenLimit" INTEGER;

-- CreateTable
CREATE TABLE "CatalogIdentity" (
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,

    CONSTRAINT "CatalogIdentity_pkey" PRIMARY KEY ("sourceId","externalId","revision")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "aliases" JSONB,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("sourceId","kind","version")
);

-- CreateIndex
CREATE INDEX "CatalogIdentity_modelVersionId_idx" ON "CatalogIdentity"("modelVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkResult_benchmarkId_modelVersionId_sourceId_evaluat_key" ON "BenchmarkResult"("benchmarkId", "modelVersionId", "sourceId", "evaluationKey", "revision");

-- AddForeignKey
ALTER TABLE "CatalogIdentity" ADD CONSTRAINT "CatalogIdentity_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogIdentity" ADD CONSTRAINT "CatalogIdentity_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
