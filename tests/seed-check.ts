import assert from "node:assert/strict";
import { getDb } from "../src/lib/db/client";

const db = getDb();
try {
  const [labs, families, models, providers, offerings, prices, benchmarks, results, sources, observations] =
    await db.$transaction([
      db.lab.count(), db.modelFamily.count(), db.modelVersion.count(), db.provider.count(),
      db.offering.count(), db.priceObservation.count(), db.benchmark.count(), db.benchmarkResult.count(),
      db.dataSource.count(), db.sourceObservation.count(),
    ]);
  assert.deepEqual([labs, families, models, providers, offerings, prices, benchmarks, results, sources, observations],
    [2, 2, 4, 2, 4, 3, 3, 8, 3, 31]);
  const openRouter = await db.dataSource.findUniqueOrThrow({ where: { id: "openrouter" } });
  assert.equal(openRouter.catalogSyncedAt, null);
  const sample = await db.modelVersion.findUniqueOrThrow({
    where: { slug: "gpt-4-1-2025-04-14" },
    include: { family: { include: { lab: true } }, offerings: { include: { prices: true } }, results: true },
  });
  assert.equal(sample.family.lab.slug, "openai");
  assert.equal(sample.offerings[0].externalModelId, "gpt-4.1-2025-04-14");
  assert.equal(sample.offerings[0].prices[0].inputPerMillion?.toFixed(2), "2.00");
  assert.ok(sample.results.some(({ score }) => score.toString() === "54.6"));
  const nano = await db.modelVersion.findUniqueOrThrow({
    where: { slug: "gpt-4-1-nano-2025-04-14" },
    include: { offerings: true },
  });
  assert.equal(nano.lifecycle, "RETIRED");
  assert.equal(nano.offerings[0].availabilityStatus, "UNAVAILABLE");
  const gemma = await db.modelVersion.findUniqueOrThrow({
    where: { slug: "gemma-3-27b-it" },
    include: { family: { include: { lab: true } }, offerings: { include: { provider: true, prices: true } } },
  });
  assert.equal(gemma.family.lab.slug, "google-deepmind");
  assert.equal(gemma.offerings[0].provider.slug, "openrouter");
  assert.equal(gemma.offerings[0].prices.length, 0);
  console.log("Verified seed counts, model relationships, price and benchmark score.");
} finally {
  await db.$disconnect();
}
