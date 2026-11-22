import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client";
import { anthropicCatalog, fetchCatalogSnapshot, geminiCatalog, huggingFaceCatalog, openaiCatalog, qwenCatalog } from "../src/ingestion/catalog-adapters";
import { localIntelligenceUrl, refreshCatalog } from "../src/ingestion/catalog-refresh";
import { ingestBenchmarkFeed, type BenchmarkFeed } from "../src/ingestion/benchmark-feed";
import { loadLatestBfcl } from "../src/ingestion/bfcl";
import { catalogPlan, normalizeCatalog, syncCatalog } from "../src/ingestion/openrouter-catalog";

const json = (value: unknown, options?: ResponseInit) => Response.json(value, options);
const openai = openaiCatalog("fixture");
const google = geminiCatalog("fixture");
const qwen = qwenCatalog("fixture", "local.cn-beijing.maas.aliyuncs.com");
const newId = "gpt-fixture-2026-11-21";
const geminiId = "gemini-fixture-001";
const fakeOpenai = async () => json({ data: [{ id: newId }, { id: "gpt-fixture-latest" }] }, { headers: { ETag: '"fixture-1"' } });
const geminiRow = { name: `models/${geminiId}`, baseModelId: "gemini-fixture", version: "001",
  displayName: "Gemini Fixture", inputTokenLimit: 100_000, outputTokenLimit: 4096 };
const qwenId = "qwen-fixture-2026-11-21";
const qwenRow = { model: qwenId, name: "Qwen Fixture", provider: "qwen",
  published_time: "2026-11-21 12:00:00", model_info: { context_window: 128_000, max_input_tokens: 120_000, max_output_tokens: 8192 },
  inference_metadata: { request_modality: ["Text", "Image"], response_modality: ["Text"] }, features: ["function-calling"],
  prices: [{ range_name: "Default", prices: [{ type: "input_token", price: "1.1", price_unit: "每百万tokens", time_band: "standard" },
    { type: "output_token", price: "2.2", price_unit: "每百万tokens", time_band: "standard" }] }] };
const qwenPage = (target = qwenId) => ({ success: true, output: { total: 2, page_no: 1, page_size: 100,
  models: [{ ...qwenRow, model: target }, { ...qwenRow, model: "qwen-fixture", equivalent_snapshot: target }] } });

it("validates all five documented feed shapes, preserving aliases, exact revisions, and explicit typed limits", async () => {
  expect(await fetchCatalogSnapshot(openai, null, fakeOpenai)).toMatchObject({ rows: [
    { id: newId, revision: newId }, { id: "gpt-fixture-latest" },
  ] });
  const claude = anthropicCatalog("fixture");
  const result = await fetchCatalogSnapshot(claude, null, async () => json({ has_more: false, data: [
    { id: "claude-sonnet-5-5", display_name: "Claude Sonnet Fixture", line: "sonnet",
      max_input_tokens: 300_000, max_tokens: 9000, capabilities: { image_input: { supported: true } } },
    { id: "claude-sonnet-4-5", display_name: "Claude 4.5 alias" },
  ] }));
  expect(result).toMatchObject({ rows: [{ id: "claude-sonnet-4-5" }, {
    revision: "claude-sonnet-5-5", contextTokens: 300_000, modalities: { input: ["text", "image"], output: ["text"] },
  }] });
  expect(await fetchCatalogSnapshot(google, null, async () => json({ models: [geminiRow] }))).toMatchObject({
    rows: [{ revision: "001", inputLimit: 100_000, outputLimit: 4096 }],
  });
  expect(await fetchCatalogSnapshot(qwen, null, async () => json(qwenPage()))).toMatchObject({
    rows: [{ id: "qwen-fixture", target: qwenId }, { id: qwenId, contextTokens: 128_000, price: { currency: "CNY", input: "1.1", output: "2.2" } }],
  });
  const speech = { ...qwenRow, inference_metadata: { request_modality: ["Audio"], response_modality: ["Text"] } };
  const speechPage = qwenPage();
  speechPage.output.models[0] = speech;
  const speechResult = await fetchCatalogSnapshot(qwen, null, async () => json(speechPage));
  expect(speechResult.rows?.[1]).not.toHaveProperty("contextTokens", 128_000);
  const hub = huggingFaceCatalog("Qwen", { slug: "qwen", name: "Alibaba Qwen", website: "https://qwenlm.github.io/" });
  expect(await fetchCatalogSnapshot(hub, null, async () => json([{ id: "Qwen/Fixture", sha: "c".repeat(40), cardData: { license: "apache-2.0" } }]))).toMatchObject({
    rows: [{ revision: "c".repeat(40), license: "apache-2.0" }],
  });
  await expect(fetchCatalogSnapshot(hub, null, async () => json([{ id: "Other/Fixture", sha: "c".repeat(40) }]))).rejects.toThrow("publisher");
});

it("bounds retries and rejects partial pagination, repeated records, and external cursor URLs", async () => {
  let calls = 0;
  await expect(fetchCatalogSnapshot(openai, null, async () => { calls++; return new Response(null, { status: 503 }); }, async () => {})).rejects.toThrow("503");
  expect(calls).toBe(3);
  await expect(fetchCatalogSnapshot(qwen, null, async () => json({ ...qwenPage(), output: { ...qwenPage().output, total: 3 } }))).rejects.toThrow("Incomplete");
  await expect(fetchCatalogSnapshot(openai, null, async () => json({ data: [{ id: newId }, { id: newId }] }))).rejects.toThrow("Duplicate");
  const hub = huggingFaceCatalog("Qwen", qwen.lab);
  await expect(fetchCatalogSnapshot(hub, null, async () => json([{ id: "Qwen/Fixture", sha: "c".repeat(40) }],
    { headers: { Link: '<https://example.test/api/models>; rel="next"' } }))).rejects.toThrow("pagination URL");
  expect(() => localIntelligenceUrl("postgresql://user@example.test:5432/ryhme_m10_test")).toThrow("loopback");
});

it("reads the newest BFCL archive at an immutable commit and skips ambiguous checkpoints", async () => {
  const commit = "a".repeat(40);
  const csv = [
    "Model,Organization,Overall Acc,Multi Turn Long Context,Web Search Acc,Memory Acc",
    "GPT-4.1-2025-04-14 (FC),OpenAI,53.96%,43%,68%,34.52%",
    "Claude-Opus-4-5-20251101 (Prompt),Anthropic,77.47%,70.50%,84.50%,73.76%",
    "Gemini-3-Pro-Preview (FC),Google,68.14%,64%,88%,75.50%",
  ].join("\n");
  const requested: string[] = [];
  const revision = await loadLatestBfcl(async input => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith("/commits/main")) return json({ sha: commit });
    if (url.endsWith(`/git/trees/${commit}`)) return json({ truncated: false, tree: [
      { path: "2025-03-17", type: "tree" }, { path: "2025-12-16", type: "tree" },
    ] });
    return new Response(csv);
  });
  expect(requested[2]).toContain(`/${commit}/2025-12-16/score/data_overall.csv`);
  expect(revision).toMatchObject({ version: "bfcl-v4-2025-12-16", feed: { source: { license: "Apache-2.0" } } });
  expect(revision.feed.evidence).toHaveLength(4);
  expect(revision.feed.evidence[0]).toMatchObject({ modelSlug: "gpt-4-1-2025-04-14", evaluatedAt: null, publishedAt: "2025-12-16" });
  expect(revision.feed.evidence.map(row => row.evaluationConfig)).toEqual([
    "Native function calling", "Native function calling", "Prompt-based function calling", "Prompt-based function calling",
  ]);
});

const testUrl = process.env.M10_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("M10 refresh through production catalog and rankings APIs", () => {
  const base = "http://127.0.0.1:3103";
  let db: PrismaClient;
  let server: ChildProcess;
  const observed = (minute: number) => new Date(Date.UTC(2026, 10, 22, 12, minute));
  const api = async (path: string) => {
    const response = await fetch(base + path);
    expect(response.status).toBe(200);
    return response.json();
  };
  beforeAll(async () => {
    const connectionString = localIntelligenceUrl(testUrl);
    if (new URL(connectionString).pathname !== "/ryhme_m10_test") throw new Error("M10 tests require a freshly seeded ryhme_m10_test.");
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3103"], {
      env: { ...process.env, DATABASE_URL: connectionString, DIRECT_URL: connectionString, VERCEL: "", VERCEL_ENV: "", VERCEL_TARGET_ENV: "" },
      stdio: "ignore", windowsHide: true,
    });
    for (let attempt = 0; attempt < 35; attempt++) {
      if (await fetch(base + "/api/health", { signal: AbortSignal.timeout(500) }).then(response => response.ok).catch(() => false)) return;
      await delay(150);
    }
    throw new Error("M10 fixture app did not start.");
  }, 15_000);
  afterAll(async () => { server?.kill(); await db?.$disconnect(); });

  it("discovers models, preserves verified metadata and history, and reranks after publications and corrections", async () => {
    expect(await refreshCatalog(db, openai, fakeOpenai, observed(0))).toMatchObject({ discovered: 1, aliases: 1 });
    const catalog = await api("/api/models?q=gpt-fixture");
    expect(catalog.data).toHaveLength(1);
    const slug = catalog.data[0].slug;
    expect(catalog.data[0]).toMatchObject({ name: newId, contextTokens: null, verifiedResults: 0 });
    expect((await api(`/api/models/${slug}`)).data.identities).toMatchObject([{ externalId: newId, revision: newId }]);
    await db.$transaction(async tx => {
      const { rows } = normalizeCatalog([{ id: "openai/gpt-fixture", canonical_slug: "openai/gpt-fixture-20261121",
        name: "Router display name", context_length: 456 }]);
      const plan = await catalogPlan(tx, rows, observed(0), true);
      expect(plan.stats).toMatchObject({ models: 0, offerings: 1, conflicts: 0, metadataUpdates: 0 });
      await syncCatalog(tx, plan, observed(0), true);
    });
    expect((await api("/api/models?q=gpt-fixture")).data).toMatchObject([{ slug, name: newId, contextTokens: null }]);
    const checkEtag = async (_url: URL | RequestInfo, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("If-None-Match")).toBe('"fixture-1"');
      return new Response(null, { status: 304 });
    };
    expect(await refreshCatalog(db, openai, checkEtag, observed(1))).toMatchObject({ state: "unchanged" });
    expect(await refreshCatalog(db, openai, fakeOpenai, observed(0))).toMatchObject({ state: "stale" });
    expect(await refreshCatalog(db, google, async () => json({ models: [geminiRow] }), observed(0))).toMatchObject({ discovered: 1 });
    const gemini = (await api("/api/models?q=Gemini%20Fixture")).data[0];
    expect(gemini).toMatchObject({ contextTokens: null, offerings: [{ inputTokenLimit: 100_000, outputTokenLimit: 4096 }] });

    expect(await refreshCatalog(db, qwen, async () => json(qwenPage()), observed(0))).toMatchObject({ discovered: 1 });
    const qwenModel = (await api("/api/models?q=Qwen%20Fixture")).data[0];
    expect(qwenModel).toMatchObject({ contextTokens: 128_000, releaseDate: "2026-11-21T00:00:00.000Z", offerings: [
      { inputTokenLimit: 120_000, outputTokenLimit: 8192, price: { currency: "CNY", inputPerMillion: "1.1" } },
    ] });
    const newQwen = "qwen-fixture-2026-11-22";
    await refreshCatalog(db, qwen, async () => json(qwenPage(newQwen)), observed(1));
    const history = await db.sourceSnapshot.findMany({ where: { sourceId: qwen.source }, orderBy: { observedAt: "asc" } });
    expect(history.map(row => row.aliases)).toMatchObject([[{ id: "qwen-fixture", target: qwenId }], [{ id: "qwen-fixture", target: newQwen }]]);
    await expect(refreshCatalog(db, qwen, async () => json({ ...qwenPage(), output: { ...qwenPage().output, total: 3 } }), observed(2))).rejects.toThrow("Incomplete");
    await expect(refreshCatalog(db, openai, async () => json({ data: [{ id: newId }] }), observed(2))).rejects.toThrow("coverage threshold");
    await expect(refreshCatalog(db, google, async () => new Response(null, { status: 403 }), observed(2))).rejects.toThrow("403");
    await expect(refreshCatalog(db, { ...openai, lab: qwen.lab },
      async () => json({ data: [{ id: newId }, { id: "changed-alias" }] }), observed(3))).rejects.toThrow("checkpoint identity");
    expect((await db.dataSource.findUniqueOrThrow({ where: { id: qwen.source } })).catalogSyncedAt).toEqual(observed(1));
    expect((await api("/api/models?q=Qwen%20Fixture")).data).toHaveLength(2);

    const benchmarkSlug = "m10-fixture-coding";
    const feed: BenchmarkFeed = {
      source: { id: "m10-test-evidence", name: "M10 fixture", homepage: "https://example.test/", license: "Fixture", licenseUrl: "https://example.test/license" },
      benchmarks: [{ slug: benchmarkSlug, name: "Comparable fixture", category: "coding", metricName: "Accuracy",
        unit: "%", direction: "HIGHER", methodology: "Pinned disposable test protocol", version: "fixture-v1", sourceUrl: "https://example.test/method" }],
      evidence: ["gpt-4-1-2025-04-14", "gpt-4-1-mini-2025-04-14"].map((modelSlug, index) => ({
        benchmarkSlug, modelSlug, score: index ? "20" : "40", evaluatedAt: "2026-11-21", publishedAt: "2026-11-21",
        evaluationKey: "fixture-run", methodologyVersion: "fixture-v1", evaluationOrigin: "INDEPENDENT",
        datasetRevision: "fixture-dataset-v1", evaluationConfig: "fixture fixed config", sourceUrl: "https://example.test/result",
      })),
      checksum: createHash("sha256").update("fixture revision 1").digest("hex"),
    };
    const publish = (payload: BenchmarkFeed, minute: number, version: string) =>
      db.$transaction(tx => ingestBenchmarkFeed(tx, payload, observed(minute), true, 2, version));
    expect(await publish(feed, 4, "v1")).toMatchObject({ newResults: 2 });
    expect(await publish(feed, 5, "v1")).toMatchObject({ newResults: 0 });
    const ranks = () => api(`/api/rankings?benchmark=${benchmarkSlug}`);
    const initial = await ranks();
    expect(initial.data.map((x: { slug: string }) => x.slug)).not.toContain(slug);
    expect(initial.data.map((x: { rank: number }) => x.rank)).toEqual([1, 2]);
    const fresh = { ...feed.evidence[0], modelSlug: null, score: "40", checkpoint: { sourceId: openai.source, externalId: newId, revision: newId } };
    const addition = { ...feed, checksum: "b".repeat(64), evidence: [fresh] };
    expect(await publish(addition, 6, "v2")).toMatchObject({ newResults: 1 });
    const tied = await ranks();
    expect(tied.data.map((x: { rank: number }) => x.rank)).toEqual([1, 1, 3]);
    expect(tied.data.find((x: { slug: string }) => x.slug === slug)).toMatchObject({ score: "40.00000000" });
    expect((await api(`/api/models/${slug}`)).data.verifiedResults).toBe(1);

    const corrected = { ...addition, checksum: "d".repeat(64), evidence: [{ ...fresh, score: "50", replacesRevision: addition.checksum }] };
    expect(await publish(corrected, 7, "v3")).toMatchObject({ corrections: 1 });
    const final = await ranks();
    expect(final.meta.cohort.id).toBe(initial.meta.cohort.id);
    expect(final.data[0]).toMatchObject({ slug, score: "50.00000000", rank: 1 });
    expect(await db.benchmarkResult.count({ where: { sourceId: feed.source.id } })).toBe(4);
    expect(await db.benchmarkResult.count({ where: { sourceId: feed.source.id, supersededAt: { not: null } } })).toBe(1);
    expect((await api(`/api/models/${slug}`)).data.results.map((row: { score: string }) => row.score)).toEqual(["50"]);
    await expect(publish({ ...corrected, checksum: "e".repeat(64) }, 8, "v3")).rejects.toThrow("changed checksum");
    await expect(publish({ ...corrected, checksum: "e".repeat(64), evidence: [{ ...fresh, score: "60" }] }, 8, "v4")).rejects.toThrow("immutable");
    await expect(publish({ ...corrected, checksum: "f".repeat(64), evidence: [{ ...fresh, score: "60", replacesRevision: corrected.checksum }] }, 3, "stale")).rejects.toThrow("Stale");
    expect((await ranks()).data[0].score).toBe("50.00000000");
    const late = "gpt-fixture-late-2026-11-22";
    const lateEvidence = { ...addition, checksum: "f".repeat(64), evidence: [{ ...fresh, score: "30",
      checkpoint: { sourceId: openai.source, externalId: late, revision: late } }] };
    expect(await publish(lateEvidence, 9, "v4")).toMatchObject({ unknownResults: 1, newResults: 0 });
    await refreshCatalog(db, openai, async () => json({ data: [{ id: newId }, { id: late }] }), observed(10));
    expect(await publish(lateEvidence, 11, "v4")).toMatchObject({ newResults: 1 });
    expect((await ranks()).data.map((row: { score: string }) => row.score)).toEqual(["50.00000000", "40.00000000", "30.00000000", "20.00000000"]);
    const crossLab = { ...addition, checksum: "9".repeat(64), evidence: [{ ...feed.evidence[0],
      modelSlug: "gemma-3-27b-it", score: "10" }] };
    expect(await publish(crossLab, 12, "v5")).toMatchObject({ newResults: 1 });
    const homepage = () => fetch(base).then(response => response.text());
    expect(await homepage()).toMatch(/<h2[^>]*>Comparable fixture<\/h2>/);
    const singleton = { ...crossLab, checksum: "8".repeat(64), benchmarks: [{ ...feed.benchmarks[0],
      slug: "m10-new-singleton", name: "New single-model result" }], evidence: [{ ...crossLab.evidence[0],
      benchmarkSlug: "m10-new-singleton", evaluationKey: "solo", evaluatedAt: "2026-11-22" }] };
    expect(await publish(singleton, 13, "v6")).toMatchObject({ newResults: 0, insufficientResults: 1 });
    expect(await homepage()).toMatch(/<h2[^>]*>Comparable fixture<\/h2>/);
    const remainingUnranked = await db.modelVersion.count({ where: { results: { none: { verifiedStatus: "VERIFIED", supersededAt: null } } } });
    expect(remainingUnranked).toBe(3);
    console.log(`M10 fixture: ranks 1,2 → 1,1,3 → 1,2,3; ${remainingUnranked} unranked versions; one historical score retained.`);
  }, 30_000);
});
