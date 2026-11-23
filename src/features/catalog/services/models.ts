import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { isRecentlyAdded } from "../presentation";
import type { CatalogCategory, CatalogQuery } from "../schemas/query";

const latestPrice = {
  orderBy: [{ observedAt: "desc" }, { id: "desc" }],
  take: 1,
} satisfies Prisma.PriceObservationFindManyArgs;

export const offeringInclude = {
  provider: { select: { name: true, slug: true } },
  prices: latestPrice,
  source: { select: { name: true } },
} satisfies Prisma.OfferingInclude;

const summaryInclude = {
  family: { include: { lab: true } },
  offerings: { include: offeringInclude, orderBy: [{ availabilityStatus: "asc" }, { id: "asc" }] },
  _count: { select: { results: { where: { verifiedStatus: "VERIFIED", supersededAt: null } } } },
} satisfies Prisma.ModelVersionInclude;

const detailInclude = {
  ...summaryInclude,
  offerings: { ...summaryInclude.offerings, include: { ...offeringInclude, prices: { ...latestPrice, take: 6 } } },
  family: {
    include: {
      lab: true,
      versions: {
        select: { id: true, slug: true, canonicalName: true, releaseDate: true },
        orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      },
    },
  },
  results: {
    where: { supersededAt: null },
    include: { benchmark: true, source: { select: { name: true } } },
    orderBy: [{ benchmarkId: "asc" }, { evaluatedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  },
  identities: { include: { source: { select: { name: true, catalogSyncedAt: true } } }, orderBy: { sourceId: "asc" } },
} satisfies Prisma.ModelVersionInclude;

type SummaryRecord = Prisma.ModelVersionGetPayload<{ include: typeof summaryInclude }>;
type DetailRecord = Prisma.ModelVersionGetPayload<{ include: typeof detailInclude }>;

function summary(model: SummaryRecord) {
  const { offerings, family, id, slug, canonicalName, releaseDate, lifecycle, contextTokens,
    modalities, capabilities, license, openWeights, updatedAt, createdAt } = model;
  return {
    id, slug, name: canonicalName, releaseDate, lifecycle, contextTokens, modalities, capabilities, license, openWeights, updatedAt, recentlyAdded: isRecentlyAdded(createdAt, Date.now()),
    family: { name: family.name, slug: family.slug, lab: { name: family.lab.name, slug: family.lab.slug } },
    verifiedResults: model._count.results,
    offerings: offerings.map(({ id, provider, externalModelId, availabilityStatus, contextOverride, inputTokenLimit, outputTokenLimit, observedAt, catalogMissingSince, sourceUrl, source, prices }) => ({
      id, provider, externalModelId, availabilityStatus, contextOverride, inputTokenLimit, outputTokenLimit, observedAt, catalogMissingSince, sourceUrl, source,
      price: prices[0] ?? null,
    })),
  };
}

async function withEvidence(models: DetailRecord[]) {
  if (!models.length) return [];
  const evidence = await getDb().sourceObservation.findMany({
    where: {
      OR: [
        { entityType: "ModelVersion", entityId: { in: models.map(({ id }) => id) } },
        { entityType: "ModelFamily", entityId: { in: models.map(({ familyId }) => familyId) } },
        { entityType: "Lab", entityId: { in: models.map(({ family }) => family.labId) } },
      ],
    },
    include: { source: { select: { name: true } } },
    orderBy: [{ observedAt: "desc" }, { id: "asc" }],
  });
  return models.map((model) => ({
    ...summary(model),
    priceHistory: model.offerings.map(({ id, provider, externalModelId, prices }) => ({ id, provider, externalModelId, prices })),
    versions: model.family.versions,
    identities: model.identities,
    results: model.results,
    sources: evidence.filter(({ entityId, entityType }) =>
      (entityType === "ModelVersion" && entityId === model.id)
      || (entityType === "ModelFamily" && entityId === model.familyId)
      || (entityType === "Lab" && entityId === model.family.labId)),
  }));
}

export type ModelDetail = Awaited<ReturnType<typeof withEvidence>>[number];

export async function findModel(slug: string) {
  const model = await getDb().modelVersion.findUnique({ where: { slug }, include: detailInclude });
  return model ? (await withEvidence([model]))[0] : null;
}

export async function findComparison(ids: string[]) {
  const models = await getDb().modelVersion.findMany({
    where: { id: { in: ids } }, include: detailInclude,
  });
  if (models.length !== ids.length) return null;
  const byId = new Map(models.map((model) => [model.id, model]));
  return withEvidence(ids.map((id) => byId.get(id)!));
}

const orders = {
  name: Prisma.sql`"canonicalName" ASC`,
  discovered: Prisma.sql`"createdAt" DESC`,
  release: Prisma.sql`"releaseDate" DESC NULLS LAST`,
  context: Prisma.sql`"contextTokens" DESC NULLS LAST`,
  price: Prisma.sql`"usdInput" ASC NULLS LAST`,
};

const verifiedEvidence = Prisma.sql`EXISTS (
  SELECT 1 FROM "BenchmarkResult" r
  WHERE r."modelVersionId" = m.id AND r."verifiedStatus" = 'VERIFIED' AND r."supersededAt" IS NULL
)`;

export const categoryCriteria: Record<CatalogCategory, Prisma.Sql> = {
  text: Prisma.sql`m.modalities @> '{"output":["text"]}'::jsonb`,
  vision: Prisma.sql`m.modalities @> '{"input":["image"]}'::jsonb`,
  multimodal: Prisma.sql`CASE WHEN jsonb_typeof(m.modalities->'input') = 'array' THEN (
    SELECT count(DISTINCT mode) > 1
    FROM jsonb_array_elements_text(m.modalities->'input') AS modes(mode)
    WHERE mode IN ('text', 'image', 'audio', 'video')
  ) ELSE FALSE END`,
  image: Prisma.sql`m.modalities @> '{"output":["image"]}'::jsonb`,
  video: Prisma.sql`m.modalities @> '{"output":["video"]}'::jsonb`,
  audio: Prisma.sql`m.modalities @> '{"input":["audio"]}'::jsonb`,
  "audio-output": Prisma.sql`m.modalities @> '{"output":["audio"]}'::jsonb`,
  "tool-calling": Prisma.sql`m.capabilities @> '["tool-calling"]'::jsonb`,
};

export async function catalogOptions() {
  const criteria = Object.entries(categoryCriteria) as [CatalogCategory, Prisma.Sql][];
  const aggregates = criteria.flatMap(([category, condition]) => [
    Prisma.sql`count(*) FILTER (WHERE ${condition})::int AS ${Prisma.raw(`"${category}"`)}`,
    Prisma.sql`count(*) FILTER (WHERE ${condition} AND evaluated)::int AS ${Prisma.raw(`"${category}-evaluated"`)}`,
  ]);
  type Option = { slug: string; name: string };
  const [options] = await getDb().$queryRaw<{
    counts: Record<string, number>; families: Option[]; labs: Option[]; providers: Option[];
    licenses: string[]; catalogSyncedAt: Date | null;
  }[]>`
    WITH evidence AS MATERIALIZED (
      SELECT m.modalities, m.capabilities, ${verifiedEvidence} AS evaluated FROM "ModelVersion" m
    ), coverage AS (
      SELECT count(*)::int AS total, count(*) FILTER (WHERE evaluated)::int AS evaluated,
        ${Prisma.join(aggregates)}
      FROM evidence m
    )
    SELECT to_jsonb(coverage) AS counts,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', slug, 'name', name) ORDER BY name, slug), '[]') FROM "ModelFamily") AS families,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', slug, 'name', name) ORDER BY name, slug), '[]') FROM "Lab") AS labs,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', slug, 'name', name) ORDER BY name, slug), '[]') FROM "Provider") AS providers,
      (SELECT COALESCE(jsonb_agg(DISTINCT license ORDER BY license), '[]') FROM "ModelVersion" WHERE license <> '') AS licenses,
      (SELECT "catalogSyncedAt" FROM "DataSource" WHERE id = 'openrouter') AS "catalogSyncedAt"
    FROM coverage
  `;
  const { counts, catalogSyncedAt, ...filters } = options;
  return {
    ...filters, catalogSyncedAt,
    syncOverdue: catalogSyncedAt !== null && Date.now() - +catalogSyncedAt > 86_400_000,
    coverage: {
      total: counts.total,
      evaluated: counts.evaluated,
      categories: criteria.map(([category]) => ({ category, total: counts[category], evaluated: counts[`${category}-evaluated`] })),
    },
  };
}

export type CatalogBreakdown = {
  publishers: { slug: string; name: string; count: number }[];
  evaluated: number;
  priced: number;
  outputPriced: number;
  anyPriced: number;
  inputMetadata: number;
  outputMetadata: number;
  capabilityMetadata: number;
  input: Record<string, number>;
  output: Record<string, number>;
  capabilities: Record<string, number>;
};

const modes = ["text", "image", "video", "audio"];
function metadataCounts(field: Prisma.Sql, values: string[]) {
  return Prisma.sql`jsonb_build_object(${Prisma.join(values.flatMap(value => [
    Prisma.sql`${value}::text`,
    Prisma.sql`count(*) FILTER (WHERE (${field}) @> ${JSON.stringify([value])}::jsonb)::int`,
  ]))})`;
}

export async function listModels(query: CatalogQuery, includeBreakdown = false) {
  const { q, family, lab, provider, lifecycle, capability, modality, license, openWeights,
    minContext, maxInputPrice, availability, category, evidence, pricing, sort, page, limit } = query;
  const priced = sort === "price" || maxInputPrice !== undefined || pricing !== undefined || includeBreakdown;
  const filters = [Prisma.sql`TRUE`];

  if (q) {
    const terms = Prisma.sql`plainto_tsquery('simple'::regconfig, regexp_replace(${q}, '[^[:alnum:]]+', ' ', 'g'))`;
    filters.push(Prisma.sql`(
      to_tsvector('simple'::regconfig, regexp_replace(m."canonicalName" || ' ' || m."slug", '[^[:alnum:]]+', ' ', 'g')) @@ ${terms}
      OR to_tsvector('simple'::regconfig, regexp_replace(f.name || ' ' || f.slug, '[^[:alnum:]]+', ' ', 'g')) @@ ${terms}
    )`);
  }
  if (family) filters.push(Prisma.sql`f.slug = ${family}`);
  if (lab) filters.push(Prisma.sql`l.slug = ${lab}`);
  if (lifecycle) filters.push(Prisma.sql`m.lifecycle = ${lifecycle}::"Lifecycle"`);
  if (minContext !== undefined) filters.push(Prisma.sql`m."contextTokens" >= ${minContext}::integer`);
  if (openWeights !== undefined) filters.push(Prisma.sql`m."openWeights" = ${openWeights}`);
  if (license) filters.push(Prisma.sql`m.license = ${license}`);
  if (capability) filters.push(Prisma.sql`m.capabilities @> ${JSON.stringify([capability])}::jsonb`);
  if (modality) filters.push(Prisma.sql`m.modalities @> ${JSON.stringify({ input: [modality] })}::jsonb`);
  if (category) filters.push(categoryCriteria[category]);
  if (evidence) filters.push(evidence === "evaluated" ? verifiedEvidence : Prisma.sql`NOT ${verifiedEvidence}`);
  if (pricing) filters.push(pricing === "documented" ? Prisma.sql`pricing."usdInput" IS NOT NULL` : Prisma.sql`pricing."usdInput" IS NULL`);
  if (provider || availability) filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM "Offering" o JOIN "Provider" p ON p.id = o."providerId"
    WHERE o."modelVersionId" = m.id
      ${provider ? Prisma.sql`AND p.slug = ${provider}` : Prisma.empty}
      ${availability ? Prisma.sql`AND o."availabilityStatus" = ${availability}::"Availability"` : Prisma.empty}
  )`);
  if (maxInputPrice !== undefined) filters.push(Prisma.sql`pricing."usdInput" <= ${maxInputPrice}::numeric`);

  return getDb().$transaction(async (db) => {
    await db.$executeRaw`SET TRANSACTION READ ONLY`;
    const [result] = await db.$queryRaw<{ total: number; ids: string[]; breakdown?: CatalogBreakdown }[]>`
      WITH filtered AS (
        SELECT m.id, m."canonicalName", m."releaseDate", m."contextTokens", m."createdAt"
          ${priced ? Prisma.sql`, pricing."usdInput"` : Prisma.empty}
          ${includeBreakdown ? Prisma.sql`, pricing."hasUsdOutput", l.slug AS publisher_slug, l.name AS publisher,
            m.modalities, m.capabilities, ${verifiedEvidence} AS evaluated` : Prisma.empty}
        FROM "ModelVersion" m
        JOIN "ModelFamily" f ON f.id = m."familyId"
        JOIN "Lab" l ON l.id = f."labId"
        ${priced ? Prisma.sql`
          LEFT JOIN LATERAL (
            SELECT MIN(observation."inputPerMillion") AS "usdInput"
              ${includeBreakdown ? Prisma.sql`, bool_or(observation."outputPerMillion" IS NOT NULL) AS "hasUsdOutput"` : Prisma.empty}
            FROM "Offering" o
            JOIN "Provider" p ON p.id = o."providerId"
            JOIN LATERAL (
              SELECT "inputPerMillion", "outputPerMillion" FROM "PriceObservation"
              WHERE "offeringId" = o.id AND currency = 'USD'
              ORDER BY "observedAt" DESC, id DESC LIMIT 1
            ) observation ON TRUE
            WHERE o."modelVersionId" = m.id AND o."availabilityStatus" = 'LISTED'
              ${provider ? Prisma.sql`AND p.slug = ${provider}` : Prisma.empty}
          ) pricing ON TRUE` : Prisma.empty}
        WHERE ${Prisma.join(filters, " AND ")}
      )
      SELECT (SELECT COUNT(*)::integer FROM filtered) AS total,
        ARRAY(SELECT id FROM filtered ORDER BY ${orders[sort]}, id ASC
          LIMIT ${limit} OFFSET ${(page - 1) * limit}) AS ids
        ${includeBreakdown ? Prisma.sql`, (SELECT jsonb_build_object(
          'publishers', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.count DESC, p.slug), '[]'::jsonb)
            FROM (SELECT publisher_slug AS slug, publisher AS name, count(*)::int AS count
              FROM filtered GROUP BY publisher_slug, publisher ORDER BY count DESC, publisher_slug LIMIT 8) p),
          'evaluated', count(*) FILTER (WHERE evaluated)::int,
          'priced', count(*) FILTER (WHERE "usdInput" IS NOT NULL)::int,
          'outputPriced', count(*) FILTER (WHERE "hasUsdOutput")::int,
          'anyPriced', count(*) FILTER (WHERE "usdInput" IS NOT NULL OR "hasUsdOutput")::int,
          'inputMetadata', count(*) FILTER (WHERE jsonb_typeof(modalities->'input') = 'array' AND modalities->'input' <> '[]'::jsonb)::int,
          'outputMetadata', count(*) FILTER (WHERE jsonb_typeof(modalities->'output') = 'array' AND modalities->'output' <> '[]'::jsonb)::int,
          'capabilityMetadata', count(*) FILTER (WHERE jsonb_typeof(capabilities) = 'array')::int,
          'input', ${metadataCounts(Prisma.sql`modalities->'input'`, modes)},
          'output', ${metadataCounts(Prisma.sql`modalities->'output'`, modes)},
          'capabilities', ${metadataCounts(Prisma.sql`capabilities`, ["tool-calling", "structured-outputs"])}
        ) FROM filtered) AS breakdown` : Prisma.empty}
    `;
    const rows = result.ids.length ? await db.modelVersion.findMany({
      where: { id: { in: result.ids } }, include: summaryInclude,
    }) : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      data: result.ids.map((id) => summary(byId.get(id)!)),
      meta: { page, limit, total: result.total, hasMore: page * limit < result.total },
      ...(result.breakdown ? { breakdown: result.breakdown } : {}),
    };
  }, { isolationLevel: "RepeatableRead" });
}
