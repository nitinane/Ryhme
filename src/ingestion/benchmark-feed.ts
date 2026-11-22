import { z } from "zod";
import { lockSource } from "./catalog-refresh";
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
  benchmarkSlug: slug, modelSlug: slug.nullable(),
  checkpoint: z.object({ sourceId: slug, externalId: z.string().min(1).max(180), revision: z.string().min(1).max(180) }).optional(),
  replacesRevision: z.string().regex(/^(?:[a-f0-9]{64})?$/).optional(), score, evaluatedAt: dateOnly, publishedAt: dateOnly,
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

export async function ingestBenchmarkFeed(tx: Prisma.TransactionClient, input: BenchmarkFeed, observedAt: Date, apply: boolean, minimumCohortModels = 2, sourceVersion?: string) {
  const { source, benchmarks, evidence, checksum } = feedShape.parse(input);
  if (apply) await lockSource(tx, source.id);
  const snapshotKey = sourceVersion ? { sourceId: source.id, kind: "benchmark", version: sourceVersion } : null;
  const snapshot = snapshotKey && await tx.sourceSnapshot.findUnique({ where: { sourceId_kind_version: snapshotKey } });
  if (snapshot && snapshot.checksum !== checksum) throw new Error("Published source version changed checksum.");
  const latest = snapshot && await tx.sourceSnapshot.findFirst({ where: { sourceId: source.id, kind: "benchmark" }, orderBy: { observedAt: "desc" } });
  const replay = snapshot && latest?.version === snapshot.version;
  const definitions = new Map(benchmarks.map((benchmark) => [benchmark.slug, benchmark]));
  if (definitions.size !== benchmarks.length) throw new Error("Duplicate benchmark definitions.");
  for (const row of evidence) {
    const definition = definitions.get(row.benchmarkSlug);
    if ((row.replacesRevision !== undefined && !sourceVersion) || !definition || (definition.unit === "%" && (new Prisma.Decimal(row.score).lt(0) || new Prisma.Decimal(row.score).gt(100)))) {
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
  const checkpointRows = await tx.catalogIdentity.findMany({
    where: { OR: evidence.flatMap(row => row.checkpoint ? [row.checkpoint] : []) },
    select: { sourceId: true, externalId: true, revision: true, modelVersionId: true },
  });
  const identityKey = (item: { sourceId: string; externalId: string; revision: string }) =>
    JSON.stringify([item.sourceId, item.externalId, item.revision]);
  const checkpointIds = new Map(checkpointRows.map(row => [identityKey(row), row.modelVersionId]));
  const matched = evidence.flatMap((row) => {
    const sourceMatch = row.checkpoint && checkpointIds.get(identityKey(row.checkpoint));
    const slugMatch = row.modelSlug && modelIds.get(row.modelSlug);
    if (sourceMatch && slugMatch && sourceMatch !== slugMatch) throw new Error("Conflicting benchmark checkpoint identities.");
    const modelVersionId = sourceMatch || slugMatch;
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

  const benchmarkIds = new Map(existingDefinitions.map(({ slug, id }) => [slug, id]));
  const previous = await tx.benchmarkResult.findMany({
    where: { sourceId: source.id, supersededAt: null, benchmarkId: { in: [...benchmarkIds.values()] }, evaluationKey: { in: [...new Set(matched.map(({ row }) => row.evaluationKey))] } },
  });
  for (const result of previous) {
    const slug = existingDefinitions.find(({ id }) => id === result.benchmarkId)!.slug;
    const settings = cohorts.get(JSON.stringify([slug, result.evaluationKey]));
    if (settings && settings !== JSON.stringify([result.methodologyVersion, result.evaluationOrigin, result.datasetRevision, result.evaluationConfig, day(result.publishedAt)])) {
      throw new Error("Stored cohort has incompatible evaluation settings.");
    }
  }
  const prior = new Map(previous.map((row) => [keyFor(row), row]));
  if (sourceVersion) {
    const slugById = new Map(existingDefinitions.map(item => [item.id, item.slug]));
    const members = new Map<string, Set<string>>();
    for (const row of previous.filter(item => item.verifiedStatus === "VERIFIED")) {
      const group = JSON.stringify([slugById.get(row.benchmarkId), row.evaluationKey, day(row.evaluatedAt)]);
      const models = members.get(group) ?? new Set<string>();
      models.add(row.modelVersionId);
      members.set(group, models);
    }
    for (const { row, modelVersionId } of matched) {
      const group = comparisonKey(row);
      const models = members.get(group) ?? new Set<string>();
      models.add(modelVersionId);
      members.set(group, models);
      cohortCounts.set(group, models.size);
    }
  }
  const candidates = matched.filter(({ row }) => cohortCounts.get(comparisonKey(row))! >= minimumCohortModels);
  const required = benchmarks.filter((definition) => candidates.some(({ row }) => row.benchmarkSlug === definition.slug));
  const replaced = new Map<string, string>();
  const validatedAdditions = matched.filter(({ row, modelVersionId }) => {
    const benchmarkId = benchmarkIds.get(row.benchmarkSlug);
    const existing = benchmarkId && prior.get(keyFor({ benchmarkId, modelVersionId, evaluationKey: row.evaluationKey }));
    if (snapshot) return !!replay && !existing && row.replacesRevision === undefined;
    if (!existing) {
      if (row.replacesRevision !== undefined) throw new Error("Correction target does not exist.");
      return true;
    }
    if (!existing.score.equals(row.score) || day(existing.evaluatedAt) !== row.evaluatedAt ||
      existing.sourceUrl !== row.sourceUrl || existing.verifiedStatus !== "VERIFIED") {
      if (!sourceVersion || row.replacesRevision !== existing.revision || existing.verifiedStatus !== "VERIFIED"
        || day(existing.evaluatedAt) !== row.evaluatedAt) {
        throw new Error("Stored result conflicts with immutable benchmark evidence.");
      }
      replaced.set(keyFor({ benchmarkId: row.benchmarkSlug, modelVersionId, evaluationKey: row.evaluationKey }), existing.id);
      return true;
    }
    return false;
  });
  const additions = validatedAdditions.filter(({ row }) => cohortCounts.get(comparisonKey(row))! >= minimumCohortModels);
  const corrections = additions.flatMap(({ row, modelVersionId }) => replaced.get(keyFor({ benchmarkId: row.benchmarkSlug, modelVersionId, evaluationKey: row.evaluationKey })) ?? []);
  const stats = {
    source: source.name, matchedModels: new Set(candidates.map(({ modelVersionId }) => modelVersionId)).size,
    unknownResults: evidence.length - matched.length, insufficientResults: matched.length - candidates.length, newResults: additions.length,
    corrections: corrections.length,
    existingResults: candidates.length - additions.length,
    newBenchmarks: required.filter(({ slug }) => !benchmarkIds.has(slug)).length,
  };
  if (!apply || (snapshot && !replay) || (!additions.length && !snapshotKey)) return stats;
  const sourceRecord = await tx.dataSource.findUnique({ where: { id: source.id } });
  if (sourceVersion && sourceRecord?.benchmarkSyncedAt && +observedAt <= +sourceRecord.benchmarkSyncedAt) {
    if (snapshot && !additions.length) return stats;
    throw new Error("Stale benchmark observation.");
  }

  await tx.dataSource.upsert({
    where: { id: source.id }, update: { benchmarkSyncedAt: observedAt },
    create: { id: source.id, name: source.name, homepage: source.homepage, sourceType: "BENCHMARK",
      benchmarkSyncedAt: observedAt, trustPolicy: `${source.license}. License: ${source.licenseUrl}. Pinned, attributed aggregate scores.` },
  });
  if (snapshotKey && !snapshot) await tx.sourceSnapshot.create({ data: { ...snapshotKey, checksum, observedAt } });
  if (!additions.length) return stats;
  for (const definition of required) {
    if (!benchmarkIds.has(definition.slug)) {
      const item = await tx.benchmark.create({ data: { ...definition, sourceId: source.id } });
      benchmarkIds.set(definition.slug, item.id);
    }
  }
  if (corrections.length) await tx.benchmarkResult.updateMany({ where: { id: { in: corrections } }, data: { supersededAt: observedAt } });
  const inserted = await tx.benchmarkResult.createManyAndReturn({
    data: additions.map(({ row, modelVersionId }) => ({
      benchmarkId: benchmarkIds.get(row.benchmarkSlug)!, modelVersionId, sourceId: source.id,
      score: row.score, evaluatedAt: row.evaluatedAt ? new Date(row.evaluatedAt) : null,
      publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
      methodologyVersion: row.methodologyVersion, evaluationOrigin: row.evaluationOrigin,
      evaluationKey: row.evaluationKey, datasetRevision: row.datasetRevision, evaluationConfig: row.evaluationConfig,
      observedAt, sourceUrl: row.sourceUrl, verifiedStatus: "VERIFIED", revision: sourceVersion ? checksum : "",
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
