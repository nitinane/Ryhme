import { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db/client";
import { docsObservedAt, launchDate, launchUrl, models } from "./catalog-data";
import { seedGemma } from "./gemma";

async function seed() {
  const db = getDb();
  try {
    await db.$transaction(async (tx) => {
      const sourceId = "openai";
      const verificationStatus = "VERIFIED" as const;
      await tx.dataSource.upsert({
        where: { id: sourceId },
        update: {},
        create: {
          id: sourceId, name: "OpenAI", homepage: "https://openai.com/",
          sourceType: "OFFICIAL",
          trustPolicy: "First-party documentation. Prices and availability are dated observations; benchmark scores are publisher-reported.",
        },
      });
      const lab = await tx.lab.upsert({
        where: { slug: "openai" },
        update: {},
        create: { slug: "openai", name: "OpenAI", website: "https://openai.com/" },
      });
      const provider = await tx.provider.upsert({
        where: { slug: "openai-api" },
        update: {},
        create: { slug: "openai-api", name: "OpenAI API", website: "https://developers.openai.com/api/" },
      });
      const family = await tx.modelFamily.upsert({
        where: { slug: "gpt-4-1" },
        update: {},
        create: { slug: "gpt-4-1", name: "GPT-4.1", labId: lab.id },
      });
      const benchmark = await tx.benchmark.upsert({
        where: { slug: "swe-bench-verified-openai-gpt-4-1-launch" },
        update: {},
        create: {
          slug: "swe-bench-verified-openai-gpt-4-1-launch", name: "SWE-bench Verified",
          category: "coding", metricName: "Tasks resolved", unit: "%", direction: "HIGHER",
          methodology: "OpenAI's GPT-4.1 launch evaluation on 477 of 500 repository issues. The publisher excluded 23 issues that could not run on its infrastructure.",
          version: "OpenAI GPT-4.1 launch, April 2025", sourceId, sourceUrl: launchUrl,
        },
      });
      const academic = [
        { slug: "gpqa-diamond-openai-gpt-4-1-launch", name: "GPQA Diamond", category: "reasoning",
          methodology: "OpenAI's GPT-4.1 launch evaluation on GPQA Diamond graduate-level science questions. The publisher used model-based answer extraction.",
          field: "gpqaScore" },
        { slug: "aime-2024-openai-gpt-4-1-launch", name: "AIME 2024", category: "mathematics",
          methodology: "OpenAI's GPT-4.1 launch results on AIME 2024 mathematics problems. The evaluation date and scoring protocol are unspecified.",
          field: "aimeScore" },
      ] as const;
      const academicBenchmarks = [];
      for (const { field, ...definition } of academic) {
        const record = await tx.benchmark.upsert({
          where: { slug: definition.slug }, update: {},
          create: { ...definition, metricName: "Reported score", unit: "%", direction: "HIGHER",
            version: "OpenAI GPT-4.1 launch, April 2025", sourceId, sourceUrl: launchUrl },
        });
        academicBenchmarks.push({ id: record.id, field });
      }

      const observations = [
        { entityType: "Lab", entityId: lab.id, field: "identity" },
        { entityType: "ModelFamily", entityId: family.id, field: "identity" },
        { entityType: "Provider", entityId: provider.id, field: "identity" },
      ].map((entity) => ({ ...entity, sourceUrl: launchUrl, observedAt: launchDate }));

      for (const entry of models) {
        const capabilities = ["tool-calling", "structured-outputs"];
        const { slug, canonicalName, externalModelId, contextTokens, lifecycle, sourceUrl, inputPerMillion, outputPerMillion, sweBenchScore } = entry;
        const model = await tx.modelVersion.upsert({
          where: { slug },
          update: {},
          create: {
            slug, canonicalName, familyId: family.id, releaseDate: launchDate, contextTokens, lifecycle,
            modalities: { input: ["text", "image"], output: ["text"] }, capabilities,
          },
        });
        await tx.modelVersion.updateMany({
          where: { id: model.id, capabilities: { equals: Prisma.DbNull } },
          data: { capabilities },
        });
        for (const field of ["canonicalName", "releaseDate", "contextTokens", "modalities", "lifecycle", "capabilities"]) {
          const launchFact = field === "releaseDate" || field === "canonicalName";
          observations.push({
            entityType: "ModelVersion", entityId: model.id, field,
            sourceUrl: launchFact ? launchUrl : sourceUrl,
            observedAt: launchFact ? launchDate : docsObservedAt,
          });
        }

        const offering = await tx.offering.upsert({
          where: { providerId_externalModelId: { providerId: provider.id, externalModelId } },
          update: {},
          create: {
            providerId: provider.id, modelVersionId: model.id, externalModelId, sourceId, sourceUrl,
            availabilityStatus: lifecycle === "RETIRED" ? "UNAVAILABLE" : "LISTED",
            observedAt: docsObservedAt,
          },
        });
        await tx.priceObservation.createMany({
          data: {
            offeringId: offering.id, sourceId, sourceUrl: launchUrl, observedAt: launchDate,
            currency: "USD", inputPerMillion, outputPerMillion,
          },
          skipDuplicates: true,
        });
        const scored = academicBenchmarks.map(({ id, field }) => ({ benchmarkId: id, score: entry[field] }));
        if (sweBenchScore !== null) scored.push({ benchmarkId: benchmark.id, score: sweBenchScore });
        await tx.benchmarkResult.createMany({
          data: scored.map((result) => ({
            ...result, modelVersionId: model.id, sourceId, sourceUrl: launchUrl,
            evaluationKey: "gpt-4-1-launch-2025-04-14", verifiedStatus: verificationStatus,
          })),
          skipDuplicates: true,
        });
      }
      await tx.sourceObservation.createMany({
        data: observations.map((observation) => ({ ...observation, sourceId, verificationStatus })),
        skipDuplicates: true,
      });
      await seedGemma(tx);
    }, { timeout: 30_000 });
    console.log("Catalog seed completed.");
  } finally {
    await db.$disconnect();
  }
}

seed().catch(() => {
  console.error("Catalog seed failed. Check development database configuration and migration status.");
  process.exitCode = 1;
});
