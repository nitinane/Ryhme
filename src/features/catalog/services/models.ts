import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { isRecentlyAdded } from "../presentation";
import type { CatalogQuery } from "../schemas/query";

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
    include: { benchmark: true, source: { select: { name: true } } },
    orderBy: [{ benchmarkId: "asc" }, { evaluatedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
  },
} satisfies Prisma.ModelVersionInclude;

type SummaryRecord = Prisma.ModelVersionGetPayload<{ include: typeof summaryInclude }>;
type DetailRecord = Prisma.ModelVersionGetPayload<{ include: typeof detailInclude }>;

function summary(model: SummaryRecord) {
  const { offerings, family, id, slug, canonicalName, releaseDate, lifecycle, contextTokens,
    modalities, capabilities, license, openWeights, updatedAt, createdAt } = model;
  return {
    id, slug, name: canonicalName, releaseDate, lifecycle, contextTokens, modalities, capabilities, license, openWeights, updatedAt, recentlyAdded: isRecentlyAdded(createdAt, Date.now()),
    family: { name: family.name, slug: family.slug, lab: { name: family.lab.name, slug: family.lab.slug } },
    offerings: offerings.map(({ id, provider, externalModelId, availabilityStatus, contextOverride, observedAt, catalogMissingSince, sourceUrl, source, prices }) => ({
      id, provider, externalModelId, availabilityStatus, contextOverride, observedAt, catalogMissingSince, sourceUrl, source,
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

export async function listModels(query: CatalogQuery) {
  const { q, family, lab, provider, lifecycle, capability, modality, license, openWeights,
    minContext, maxInputPrice, availability, sort, page, limit } = query;
  const priced = sort === "price" || maxInputPrice !== undefined;
  const filters = [Prisma.sql`TRUE`];

  if (q) filters.push(Prisma.sql`
    to_tsvector('simple'::regconfig, regexp_replace(m."canonicalName" || ' ' || m."slug", '[^[:alnum:]]+', ' ', 'g'))
    @@ plainto_tsquery('simple'::regconfig, regexp_replace(${q}, '[^[:alnum:]]+', ' ', 'g'))`);
  if (family) filters.push(Prisma.sql`f.slug = ${family}`);
  if (lab) filters.push(Prisma.sql`l.slug = ${lab}`);
  if (lifecycle) filters.push(Prisma.sql`m.lifecycle = ${lifecycle}::"Lifecycle"`);
  if (minContext !== undefined) filters.push(Prisma.sql`m."contextTokens" >= ${minContext}::integer`);
  if (openWeights !== undefined) filters.push(Prisma.sql`m."openWeights" = ${openWeights}`);
  if (license) filters.push(Prisma.sql`m.license = ${license}`);
  if (capability) filters.push(Prisma.sql`m.capabilities @> ${JSON.stringify([capability])}::jsonb`);
  if (modality) filters.push(Prisma.sql`m.modalities @> ${JSON.stringify({ input: [modality] })}::jsonb`);
  if (provider || availability) filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM "Offering" o JOIN "Provider" p ON p.id = o."providerId"
    WHERE o."modelVersionId" = m.id
      ${provider ? Prisma.sql`AND p.slug = ${provider}` : Prisma.empty}
      ${availability ? Prisma.sql`AND o."availabilityStatus" = ${availability}::"Availability"` : Prisma.empty}
  )`);
  if (maxInputPrice !== undefined) filters.push(Prisma.sql`pricing."usdInput" <= ${maxInputPrice}::numeric`);

  return getDb().$transaction(async (db) => {
    const [result] = await db.$queryRaw<{ total: number; ids: string[] }[]>`
      WITH filtered AS (
        SELECT m.id, m."canonicalName", m."releaseDate", m."contextTokens", m."createdAt"
          ${priced ? Prisma.sql`, pricing."usdInput"` : Prisma.empty}
        FROM "ModelVersion" m
        JOIN "ModelFamily" f ON f.id = m."familyId"
        JOIN "Lab" l ON l.id = f."labId"
        ${priced ? Prisma.sql`
          LEFT JOIN LATERAL (
            SELECT MIN(observation."inputPerMillion") AS "usdInput"
            FROM "Offering" o
            JOIN "Provider" p ON p.id = o."providerId"
            JOIN LATERAL (
              SELECT "inputPerMillion" FROM "PriceObservation"
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
    `;
    const rows = result.ids.length ? await db.modelVersion.findMany({
      where: { id: { in: result.ids } }, include: summaryInclude,
    }) : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      data: result.ids.map((id) => summary(byId.get(id)!)),
      meta: { page, limit, total: result.total, hasMore: page * limit < result.total },
    };
  }, { isolationLevel: "RepeatableRead" });
}

export async function catalogOptions() {
  const db = getDb();
  const [families, labs, providers, licenses, source] = await Promise.all([
    db.modelFamily.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.lab.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.provider.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
    db.modelVersion.findMany({
      select: { license: true }, distinct: ["license"], where: { license: { not: null } }, orderBy: { license: "asc" },
    }),
    db.dataSource.findUnique({ where: { id: "openrouter" }, select: { catalogSyncedAt: true } }),
  ]);
  const catalogSyncedAt = source?.catalogSyncedAt ?? null;
  return { families, labs, providers, catalogSyncedAt, syncOverdue: catalogSyncedAt !== null && Date.now() - +catalogSyncedAt > 86_400_000, licenses: licenses.flatMap(({ license }) => license ? [license] : []) };
}
