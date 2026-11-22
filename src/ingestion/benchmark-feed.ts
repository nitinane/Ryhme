import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { rankingCategories } from "../features/benchmarks/categories";
import { slug } from "../features/catalog/schemas/query";

const https = z.url({ protocol: /^https$/ }).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password;
});
const dateOnly = z.iso.date().nullable();
const score = z.string().regex(/^-?\d{1,10}(?:\.\d{1,8})?$/).refine((value) => new Prisma.Decimal(value).abs().lt("10000000000"));
const benchmarkShape = z.object({
  slug, name: z.string().min(1).max(120), category: z.enum(rankingCategories),
  metricName: z.string().min(1).max(120), unit: z.string().min(1).max(24), direction: z.enum(["HIGHER", "LOWER"]),
  methodology: z.string().min(1).max(2000), version: z.string().min(1).max(120), sourceUrl: https,
});
const evidenceShape = z.object({
  benchmarkSlug: slug, modelSlug: slug.nullable(), score, evaluatedAt: dateOnly, publishedAt: dateOnly,
  evaluationKey: z.string().min(1).max(120), methodologyVersion: z.string().min(1).max(120),
  evaluationOrigin: z.enum(["INDEPENDENT", "PUBLISHER"]), datasetRevision: z.string().min(1).max(200).nullable(),
  evaluationConfig: z.string().min(1).max(200).nullable(), sourceUrl: https,
});
const feedShape = z.object({
  source: z.object({
    id: slug, name: z.string().min(1).max(120), homepage: https,
    license: z.string().min(1).max(80), licenseUrl: https,
  }),
  benchmarks: z.array(benchmarkShape).min(1).max(50),
  evidence: z.array(evidenceShape).min(1).max(5000),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

export type BenchmarkFeed = z.infer<typeof feedShape>;
type ResultKey = { benchmarkId: string; modelVersionId: string; evaluationKey: string };
const keyFor = ({ benchmarkId, modelVersionId, evaluationKey }: ResultKey) =>
  JSON.stringify([benchmarkId, modelVersionId, evaluationKey]);
const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export async function ingestBenchmarkFeed(tx: Prisma.TransactionClient, input: BenchmarkFeed, observedAt: Date, apply: boolean, minimumCohortModels = 2) {
  const { source, benchmarks, evidence, checksum } = feedShape.parse(input);
  const definitions = new Map(benchmarks.map((benchmark) => [benchmark.slug, benchmark]));
  if (definitions.size !== benchmarks.length) throw new Error("Duplicate benchmark definitions.");
  for (const row of evidence) {
    const definition = definitions.get(row.benchmarkSlug);
    if (!definition || (definition.unit === "%" && (new Prisma.Decimal(row.score).lt(0) || new Prisma.Decimal(row.score).gt(100)))) {
      throw new Error("Unknown benchmark definition or score outside its units.");
    }
  }

  const models = await tx.modelVersion.findMany({
    where: { slug: { in: [...new Set(evidence.flatMap(({ modelSlug }) => modelSlug ? [modelSlug] : []))] } },
    select: { slug: true, id: true },
  });
  const modelIds = new Map(models.map(({ slug, id }) => [slug, id]));
  const existingDefinitions = await tx.benchmark.findMany({ where: { slug: { in: [...definitions.keys()] } } });
  for (const previous of existingDefinitions) {
    const expected = definitions.get(previous.slug)!;
    if (previous.sourceId !== source.id || Object.entries(expected).some(([field, value]) => previous[field as keyof typeof previous] !== value)) {
      throw new Error("Conflicting benchmark definition. Use a distinct versioned identity.");
    }
  }
  const matched = evidence.flatMap((row) => {
    const modelVersionId = row.modelSlug && modelIds.get(row.modelSlug);
    return modelVersionId ? [{ row, modelVersionId }] : [];
  });
  const duplicate = new Set<string>();
  const cohorts = new Map<string, string>();
  for (const { row, modelVersionId } of matched) {
    const key = keyFor({ benchmarkId: row.benchmarkSlug, modelVersionId, evaluationKey: row.evaluationKey });
    if (duplicate.has(key)) throw new Error("Duplicate evaluated model within a benchmark cohort.");
    duplicate.add(key);
    const cohort = JSON.stringify([row.benchmarkSlug, row.evaluationKey]);
    const settings = JSON.stringify([row.methodologyVersion, row.evaluationOrigin, row.datasetRevision, row.evaluationConfig, row.publishedAt]);
    if (cohorts.has(cohort) && cohorts.get(cohort) !== settings) throw new Error("Incompatible evaluation settings within a cohort.");
    cohorts.set(cohort, settings);
  }

  const comparisonKey = (row: BenchmarkFeed["evidence"][number]) =>
    JSON.stringify([row.benchmarkSlug, row.evaluationKey, row.evaluatedAt]);
  const cohortCounts = new Map<string, number>();
  for (const { row } of matched) {
    const key = comparisonKey(row);
    cohortCounts.set(key, (cohortCounts.get(key) ?? 0) + 1);
  }
  const candidates = matched.filter(({ row }) => cohortCounts.get(comparisonKey(row))! >= minimumCohortModels);
  const required = benchmarks.filter((definition) => candidates.some(({ row }) => row.benchmarkSlug === definition.slug));

  const benchmarkIds = new Map(existingDefinitions.map(({ slug, id }) => [slug, id]));
  const previous = await tx.benchmarkResult.findMany({
    where: { sourceId: source.id, benchmarkId: { in: [...benchmarkIds.values()] }, evaluationKey: { in: [...new Set(matched.map(({ row }) => row.evaluationKey))] } },
  });
  for (const result of previous) {
    const slug = existingDefinitions.find(({ id }) => id === result.benchmarkId)!.slug;
    const settings = cohorts.get(JSON.stringify([slug, result.evaluationKey]));
    if (settings && settings !== JSON.stringify([result.methodologyVersion, result.evaluationOrigin, result.datasetRevision, result.evaluationConfig, day(result.publishedAt)])) {
      throw new Error("Stored cohort has incompatible evaluation settings.");
    }
  }
  const prior = new Map(previous.map((row) => [keyFor(row), row]));
  const validatedAdditions = matched.filter(({ row, modelVersionId }) => {
    const benchmarkId = benchmarkIds.get(row.benchmarkSlug);
    const existing = benchmarkId && prior.get(keyFor({ benchmarkId, modelVersionId, evaluationKey: row.evaluationKey }));
    if (!existing) return true;
    if (!existing.score.equals(row.score) || day(existing.evaluatedAt) !== row.evaluatedAt ||
      existing.sourceUrl !== row.sourceUrl || existing.verifiedStatus !== "VERIFIED") {
      throw new Error("Stored result conflicts with immutable benchmark evidence.");
    }
    return false;
  });
  const additions = validatedAdditions.filter(({ row }) => cohortCounts.get(comparisonKey(row))! >= minimumCohortModels);
  const stats = {
    source: source.name, matchedModels: new Set(candidates.map(({ modelVersionId }) => modelVersionId)).size,
    unknownResults: evidence.length - matched.length, insufficientResults: matched.length - candidates.length, newResults: additions.length,
    existingResults: candidates.length - additions.length,
    newBenchmarks: required.filter(({ slug }) => !benchmarkIds.has(slug)).length,
  };
  if (!apply || !additions.length) return stats;

  await tx.dataSource.upsert({
    where: { id: source.id }, update: {},
    create: { id: source.id, name: source.name, homepage: source.homepage, sourceType: "BENCHMARK",
      trustPolicy: `${source.license}. License: ${source.licenseUrl}. Pinned, attributed aggregate scores.` },
  });
  for (const definition of required) {
    if (!benchmarkIds.has(definition.slug)) {
      const item = await tx.benchmark.create({ data: { ...definition, sourceId: source.id } });
      benchmarkIds.set(definition.slug, item.id);
    }
  }
  const inserted = await tx.benchmarkResult.createManyAndReturn({
    data: additions.map(({ row, modelVersionId }) => ({
      benchmarkId: benchmarkIds.get(row.benchmarkSlug)!, modelVersionId, sourceId: source.id,
      score: row.score, evaluatedAt: row.evaluatedAt ? new Date(row.evaluatedAt) : null,
      publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
      methodologyVersion: row.methodologyVersion, evaluationOrigin: row.evaluationOrigin,
      evaluationKey: row.evaluationKey, datasetRevision: row.datasetRevision, evaluationConfig: row.evaluationConfig,
      observedAt, sourceUrl: row.sourceUrl, verifiedStatus: "VERIFIED",
    })),
    select: { id: true, sourceUrl: true },
  });
  await tx.sourceObservation.createMany({ data: inserted.map(({ id, sourceUrl }) => ({
    sourceId: source.id, entityType: "BenchmarkResult", entityId: id, field: "benchmark score",
    observedAt: new Date(observedAt.toISOString().slice(0, 10)), sourceUrl,
    rawChecksum: checksum, verificationStatus: "VERIFIED",
  })) });
  return stats;
}
