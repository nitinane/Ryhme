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
    [1, 1, 3, 1, 3, 3, 1, 2, 1, 21]);
  const sample = await db.modelVersion.findUniqueOrThrow({
    where: { slug: "gpt-4-1-2025-04-14" },
    include: { family: { include: { lab: true } }, offerings: { include: { prices: true } }, results: true },
  });
  assert.equal(sample.family.lab.slug, "openai");
  assert.equal(sample.offerings[0].externalModelId, "gpt-4.1-2025-04-14");
  assert.equal(sample.offerings[0].prices[0].inputPerMillion?.toFixed(2), "2.00");
  assert.equal(sample.results[0].score.toString(), "54.6");
  const nano = await db.modelVersion.findUniqueOrThrow({
    where: { slug: "gpt-4-1-nano-2025-04-14" },
    include: { offerings: true },
  });
  assert.equal(nano.lifecycle, "RETIRED");
  assert.equal(nano.offerings[0].availabilityStatus, "UNAVAILABLE");
  console.log("Verified seed counts, model relationships, price and benchmark score.");
} finally {
  await db.$disconnect();
}
