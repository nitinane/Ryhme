import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { rankingCategories } from "./categories";
import { scoreDirection, type RankingQuery } from "./query";

type ScoreRow = {
  rank: number; slug: string; name: string; labName: string; score: string; sourceUrl: string;
};

export async function rankings(query: RankingQuery) {
  const db = getDb();
  const [definitions, providers, labs, models] = await Promise.all([
    db.benchmark.findMany({
      include: { source: { select: { name: true } } },
      where: { results: { some: { verifiedStatus: "VERIFIED" } } },
      orderBy: [{ category: "asc" }, { name: "asc" }, { id: "asc" }],
    }),
    db.provider.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.lab.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.modelVersion.findMany({
      select: { slug: true, canonicalName: true }, orderBy: [{ canonicalName: "asc" }, { slug: "asc" }],
    }),
  ]);
  const coveredCategories = [...new Set<string>(definitions.map(({ category }) => category))];
  const categories = [...new Set<string>([...rankingCategories, ...coveredCategories])];
  const requested = definitions.find(({ slug }) => slug === query.benchmark);
  const category = query.category ?? requested?.category ?? (coveredCategories.includes("coding") ? "coding" : coveredCategories[0] ?? "coding");
  const benchmarks = definitions.filter((item) => item.category === category);
  const benchmark = query.benchmark ? benchmarks.find(({ slug }) => slug === query.benchmark) : benchmarks[0];

  const groups = benchmark ? await db.benchmarkResult.groupBy({
    by: ["sourceId", "evaluationKey", "methodologyVersion", "evaluatedAt", "evaluationOrigin", "datasetRevision", "evaluationConfig", "publishedAt"],
    where: { benchmarkId: benchmark.id, verifiedStatus: "VERIFIED" },
    _min: { id: true },
    _count: { id: true },
    _max: { observedAt: true },
    orderBy: [{ evaluatedAt: { sort: "desc", nulls: "last" } }, { publishedAt: { sort: "desc", nulls: "last" } }, { _count: { id: "desc" } }, { _min: { id: "asc" } }],
  }) : [];
  const cohorts = groups.map(({ _min, _count, _max, ...group }) => ({ ...group, id: _min.id!, evaluatedModels: _count.id, observedAt: _max.observedAt }));
  const cohort = cohorts.find(({ id }) => id === query.cohort) ?? cohorts.find(({ evaluatedModels }) => evaluatedModels >= 2) ?? cohorts[0];
  const empty = { data: [] as ScoreRow[], meta: { total: 0, eligible: 0, page: query.page, limit: query.limit, hasMore: false } };
  const cohortSource = cohort && (await db.dataSource.findUnique({ where: { id: cohort.sourceId }, select: { name: true, homepage: true } }));
  const selection = { categories, coveredCategories, category, benchmarks, benchmark, providers, labs, models, cohorts, cohort, cohortSource };
  if (!benchmark || !cohort || cohort.evaluatedModels < 2) return { ...empty, ...selection };

  const better = scoreDirection(benchmark.direction) === "DESC" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const display = query.sort === "worst" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const providerFilter = query.provider ? Prisma.sql`AND EXISTS (
    SELECT 1 FROM "Offering" o JOIN "Provider" p ON p.id = o."providerId"
    WHERE o."modelVersionId" = m.id AND p.slug = ${query.provider}
  )` : Prisma.empty;
  const [result] = await db.$queryRaw<{ total: number; eligible: number; rows: ScoreRow[] }[]>`
    WITH eligible AS (
      SELECT m.id, m.slug, m."canonicalName" AS name, l.name AS "labName"
      FROM "ModelVersion" m JOIN "ModelFamily" f ON f.id = m."familyId"
      JOIN "Lab" l ON l.id = f."labId"
      WHERE TRUE ${providerFilter}
        ${query.q ? Prisma.sql`AND strpos(lower(m."canonicalName" || ' ' || m.slug || ' ' || l.name), lower(${query.q})) > 0` : Prisma.empty}
        ${query.lab ? Prisma.sql`AND l.slug = ${query.lab}` : Prisma.empty}
        ${query.model ? Prisma.sql`AND m.slug = ${query.model}` : Prisma.empty}
    ), ranked AS (
      SELECT (RANK() OVER (ORDER BY r.score ${better}))::integer AS rank, e.slug, e.name, e."labName",
        r.score::text AS score, r."sourceUrl"
      FROM eligible e JOIN "BenchmarkResult" r ON r."modelVersionId" = e.id
      WHERE r."benchmarkId" = ${benchmark.id} AND r."sourceId" = ${cohort.sourceId}
        AND r."evaluationKey" = ${cohort.evaluationKey} AND r."verifiedStatus" = 'VERIFIED'
        AND r."evaluationOrigin" = ${cohort.evaluationOrigin}::"EvaluationOrigin"
        AND r."datasetRevision" IS NOT DISTINCT FROM ${cohort.datasetRevision}::text
        AND r."evaluationConfig" IS NOT DISTINCT FROM ${cohort.evaluationConfig}::text
        AND r."publishedAt" IS NOT DISTINCT FROM ${cohort.publishedAt?.toISOString().slice(0, 10) ?? null}::date
        AND r."methodologyVersion" IS NOT DISTINCT FROM ${cohort.methodologyVersion}::text
        AND r."evaluatedAt" IS NOT DISTINCT FROM ${cohort.evaluatedAt ? cohort.evaluatedAt.toISOString().slice(0, 10) : null}::date
    )
    SELECT (SELECT COUNT(*)::integer FROM ranked) AS total,
      (SELECT COUNT(*)::integer FROM eligible) AS eligible,
      COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.rank ${display}, p.slug) FROM (
        SELECT * FROM ranked ORDER BY rank ${display}, slug LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}
      ) p), '[]'::jsonb) AS rows
  `;
  return { ...selection, data: result.rows, meta: {
    total: result.total, eligible: result.eligible, page: query.page, limit: query.limit,
    hasMore: query.page * query.limit < result.total,
  } };
}
