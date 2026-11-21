import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseBfcl } from "../src/ingestion/bfcl";
import { ingestBenchmarkFeed, type BenchmarkFeed } from "../src/ingestion/benchmark-feed";
import { evaluationOriginLabel, rankingCategories } from "../src/features/benchmarks/categories";
import { scoreDirection } from "../src/features/benchmarks/query";

const csv = [
  "Model,Overall Acc,Multi Turn Long Context,Notes",
  'GPT-4o-2024-11-20 (FC),69.58%,58.00%,"quoted, value"',
  "GPT-4o-2024-11-20 (Prompt),72.08%,55.00%,",
  "GPT-4o-2024-11-21 (FC),71.00%,N/A,",
].join("\n");

it("normalizes BFCL scores and keeps configuration, exact model identity and archive date distinct", () => {
  const { source, benchmarks, evidence } = parseBfcl(csv);
  expect(source.license).toBe("Apache-2.0");
  expect(benchmarks.map(item => item.category)).toEqual(["instruction-following", "long-context"]);
  expect(evidence[0]).toMatchObject({ score: "69.58", evaluatedAt: null, publishedAt: "2025-03-17",
    evaluationOrigin: "INDEPENDENT", evaluationConfig: "Native function calling" });
  expect(evidence[0].modelSlug).toMatch(/openai-gpt-4o-2024-11-20/);
  expect(evidence[2].modelSlug).toBe(evidence[0].modelSlug);
  expect(evidence[2].evaluationKey).not.toBe(evidence[0].evaluationKey);
  expect(evidence[4].modelSlug).toBeNull();
  expect(evidence[0].sourceUrl).toContain("cadd76a8dc");
  expect(() => parseBfcl(csv.replace("69.58%", "unknown"))).toThrow("score format");
});

it("registers ten categories and distinguishes score direction and evaluation origin", () => {
  expect(rankingCategories).toHaveLength(10);
  expect(scoreDirection("HIGHER")).toBe("DESC");
  expect(scoreDirection("LOWER")).toBe("ASC");
  expect(evaluationOriginLabel.PUBLISHER).toBe("Publisher-reported evaluation");
  expect(evaluationOriginLabel.INDEPENDENT).toBe("Independent evaluation");
});

const testUrl = process.env.BENCHMARK_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("benchmark ingestion with disposable PostgreSQL", () => {
  let db: PrismaClient;
  beforeAll(() => {
    const url = new URL(testUrl!);
    if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/ryhme_m6_test"
      || url.search || url.hash) throw new Error("Benchmark tests require disposable loopback PostgreSQL.");
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
  });
  afterAll(() => db?.$disconnect());

  const fixture: BenchmarkFeed = {
    source: { id: "m6-test-evidence", name: "M6 integration fixture", homepage: "https://example.test/",
      license: "Fixture", licenseUrl: "https://example.test/license" },
    benchmarks: [{ slug: "m6-latency-test", name: "M6 latency test", category: "speed-latency", metricName: "Latency",
      unit: "ms", direction: "LOWER", methodology: "Local integration fixture", version: "test v1", sourceUrl: "https://example.test/method" }],
    evidence: ["gpt-4-1-2025-04-14", "gpt-4-1-mini-2025-04-14", "gpt-4-1-nano-2025-04-14", "unknown-exact-checkpoint"]
      .map((modelSlug, i) => ({
        benchmarkSlug: "m6-latency-test", modelSlug, score: i < 2 ? "1.25000001" : "2.50",
        evaluatedAt: null, publishedAt: "2025-06-01", evaluationKey: "m6-test-run", methodologyVersion: "test v1",
        evaluationOrigin: "INDEPENDENT", datasetRevision: "dataset test v1", evaluationConfig: "fixed test",
        sourceUrl: "https://example.test/result",
      })),
    checksum: "a".repeat(64),
  };
  const ingest = (feed: BenchmarkFeed, apply = true) => db.$transaction(
    tx => ingestBenchmarkFeed(tx, feed, new Date("2026-11-21T19:00:00Z"), apply), { isolationLevel: "Serializable" },
  );

  it("previews, imports exact identities with attributed scores, preserves history, and rejects conflicting evidence atomically", async () => {
    expect(await ingest(fixture, false)).toMatchObject({ matchedModels: 3, newResults: 3, unknownResults: 1 });
    expect(await db.benchmarkResult.count({ where: { sourceId: fixture.source.id } })).toBe(0);
    expect(await ingest(fixture)).toMatchObject({ matchedModels: 3, newResults: 3, unknownResults: 1 });
    expect(await ingest(fixture)).toMatchObject({ existingResults: 3, newResults: 0 });
    const results = await db.benchmarkResult.findMany({ where: { sourceId: fixture.source.id }, orderBy: {score:"asc"} });
    expect(results[0]).toMatchObject({ evaluatedAt: null, evaluationOrigin: "INDEPENDENT", sourceUrl: "https://example.test/result" });
    expect(results.map(({ score }) => score.toString())).toEqual(["1.25000001", "1.25000001", "2.5"]);
    expect(await db.sourceObservation.count({ where: { sourceId: fixture.source.id, rawChecksum: fixture.checksum } })).toBe(3);
    const duplicate = { ...fixture, evidence: [...fixture.evidence, fixture.evidence[0]] };
    await expect(ingest(duplicate)).rejects.toThrow("Duplicate evaluated model");
    const changed = { ...fixture, evidence: [{ ...fixture.evidence[0], score: "2" }] };
    await expect(ingest(changed)).rejects.toThrow("conflicts with immutable");
    const config = { ...fixture, evidence: [{ ...fixture.evidence[0], evaluationConfig: "changed settings" }, fixture.evidence[1]] };
    await expect(ingest(config)).rejects.toThrow("Incompatible evaluation settings");
    const history = { ...fixture, evidence: [{ ...fixture.evidence[0], evaluationKey: "m6-test-run-2",
      methodologyVersion: "test v2", publishedAt: "2025-05-31", score: "0.9" }] };
    expect(await ingest(history)).toMatchObject({ newResults: 1 });
    expect(await db.benchmarkResult.count({ where: { sourceId: fixture.source.id } })).toBe(4);
    expect(await db.benchmarkResult.count({ where: { sourceId: "openai", evaluationOrigin: "PUBLISHER" } })).toBe(8);
  });
});
