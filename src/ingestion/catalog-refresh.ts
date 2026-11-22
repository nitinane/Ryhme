import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { fetchCatalogSnapshot, type CatalogAdapter, type CatalogModel } from "./catalog-adapters";
import { exactRouterSlugs, stableSlug } from "./openrouter-catalog";

export function localIntelligenceUrl(value: string | undefined) {
  const url = URL.parse(value ?? "");
  if (url?.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
    !url.port || !/^\/ryhme_[a-z0-9_]+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error("Set RYHME_INTELLIGENCE_DATABASE_URL to a disposable loopback Ryhme database.");
  }
  return url.href;
}

export async function lockSource(tx: Prisma.TransactionClient, sourceId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(2090871602, hashtext(${sourceId}))`;
}

async function upsertModel(tx: Prisma.TransactionClient, adapter: CatalogAdapter, row: CatalogModel, labId: string, observedAt: Date, checksum: string) {
  const sourceId = adapter.source;
  const key = { sourceId, externalId: row.id, revision: row.revision };
  const former = await tx.catalogIdentity.findUnique({ where: { sourceId_externalId_revision: key } });
  const direct = adapter.provider && await tx.offering.findFirst({
    where: { provider: { slug: adapter.provider }, externalModelId: row.id }, select: { modelVersionId: true },
  });
  const routerKeys = adapter.routerNamespace ? exactRouterSlugs(`${adapter.routerNamespace}/${row.id}`) : [];
  const routerMatches = routerKeys.length ? await tx.modelVersion.findMany({
    where: { slug: { in: routerKeys } }, select: { id: true, family: { select: { labId: true } } },
  }) : [];
  if (routerMatches.length > 1) throw new Error("Conflicting OpenRouter checkpoint identities.");
  const router = routerMatches[0];
  if (former && direct && former.modelVersionId !== direct.modelVersionId) throw new Error("Conflicting direct model identity.");
  if (router && (router.family.labId !== labId || (direct && router.id !== direct.modelVersionId) || (former && router.id !== former.modelVersionId))) {
    throw new Error("Conflicting OpenRouter checkpoint identity.");
  }
  const modelId = former?.modelVersionId ?? (direct ? direct.modelVersionId : undefined) ?? (router ? router.id : undefined);
  const data = { contextTokens: row.contextTokens, releaseDate: row.releaseDate ? new Date(row.releaseDate) : undefined,
    license: row.license, modalities: row.modalities, capabilities: row.capabilities, lifecycle: row.lifecycle };
  const present = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  const sourceUrl = row.url ?? adapter.homepage;
  const model = modelId ? await tx.modelVersion.findUniqueOrThrow({ where: { id: modelId }, include: { family: true } }) : await (async () => {
    const familyName = row.family ?? row.id;
    const familySlug = stableSlug(`family/${adapter.lab.slug}/${familyName}`);
    const family = await tx.modelFamily.upsert({ where: { slug: familySlug }, update: {},
      create: { slug: familySlug, name: familyName, labId } });
    return tx.modelVersion.create({ data: { slug: routerKeys[0] ?? stableSlug(`model/${sourceId}/${row.id}/${row.revision}`),
      canonicalName: row.name, familyId: family.id, ...data }, include: { family: true } });
  })();
  if (model.family.labId !== labId) throw new Error("First-party identity disagrees with the stored developer.");

  // Existing conflicting facts stay intact. Feed availability is tracked on the offering.
  const accepted = Object.fromEntries(Object.entries(present).filter(([field, value]) => {
    const previous = model[field as keyof typeof data];
    return previous == null || (field === "lifecycle" && previous === "UNKNOWN")
      || JSON.stringify(previous) === JSON.stringify(value);
  }));
  if (modelId && Object.keys(accepted).length) await tx.modelVersion.update({ where: { id: model.id }, data: accepted });
  if (!former) await tx.catalogIdentity.create({ data: { ...key, modelVersionId: model.id } });
  const observations = (entityType: string, entityId: string, fields: string[]) => fields.map(field => ({
    sourceId, entityType, entityId, field, sourceUrl, observedAt, rawChecksum: checksum, verificationStatus: "VERIFIED" as const,
  }));
  await tx.sourceObservation.createMany({ data: [
    ...observations("Lab", labId, ["identity"]),
    ...observations("ModelFamily", model.familyId, row.family === model.family.name ? ["family identity"] : []),
    ...observations("ModelVersion", model.id, ["exact checkpoint identity", ...(row.name === model.canonicalName ? ["canonicalName"] : []), ...Object.keys(accepted)]),
    ], skipDuplicates: true });
  if (adapter.provider) {
    const providerId = adapter.provider;
    const provider = await tx.provider.upsert({ where: { slug: providerId }, update: {},
      create: { slug: providerId, name: adapter.name, website: adapter.homepage } });
    const offering = await tx.offering.upsert({ where: { providerId_externalModelId: { providerId: provider.id, externalModelId: row.id } },
      update: { sourceId, sourceUrl, observedAt, availabilityStatus: row.lifecycle === "RETIRED" ? "UNAVAILABLE" : "LISTED",
        inputTokenLimit: row.inputLimit, outputTokenLimit: row.outputLimit },
      create: { providerId: provider.id, modelVersionId: model.id, externalModelId: row.id, sourceId, sourceUrl, observedAt,
        availabilityStatus: row.lifecycle === "RETIRED" ? "UNAVAILABLE" : "LISTED",
        inputTokenLimit: row.inputLimit, outputTokenLimit: row.outputLimit } });
    if (row.price) {
      await tx.priceObservation.createMany({ data: { offeringId: offering.id, sourceId, sourceUrl, observedAt,
        currency: row.price.currency, inputPerMillion: row.price.input, outputPerMillion: row.price.output }, skipDuplicates: true });
    }
    await tx.sourceObservation.createMany({ data: observations("Offering", offering.id, [
      "availabilityStatus", ...(row.inputLimit === undefined ? [] : ["inputTokenLimit"]),
      ...(row.outputLimit === undefined ? [] : ["outputTokenLimit"]),
    ]), skipDuplicates: true });
  }
  return { id: model.id, created: !modelId };
}

export async function refreshCatalog(db: PrismaClient, adapter: CatalogAdapter, fetcher = fetch, observedAt = new Date()) {
  const previous = await db.dataSource.findUnique({ where: { id: adapter.source } });
  const payload = await fetchCatalogSnapshot(adapter, previous?.catalogEtag, fetcher);
  return db.$transaction(async tx => {
    await lockSource(tx, adapter.source);
    const current = await tx.dataSource.findUnique({ where: { id: adapter.source } });
    if (current?.catalogSyncedAt && +current.catalogSyncedAt >= +observedAt) return { state: "stale" as const, discovered: 0 };
    if ("unchanged" in payload) {
      if (!current || current.catalogEtag !== previous?.catalogEtag) return { state: "stale" as const, discovered: 0 };
      await tx.dataSource.update({ where: { id: adapter.source }, data: { catalogSyncedAt: observedAt } });
      return { state: "unchanged" as const, discovered: 0 };
    }
    const checksum = createHash("sha256").update(JSON.stringify(payload.rows)).digest("hex");
    const snapshot = await tx.sourceSnapshot.findFirst({ where: { sourceId: adapter.source, kind: "catalog" }, orderBy: { observedAt: "desc" } });
    if (snapshot?.modelCount && payload.rows.length < Math.ceil(snapshot.modelCount * .75)) {
      throw new Error("Catalog snapshot fell below the previous coverage threshold.");
    }
    await tx.dataSource.upsert({ where: { id: adapter.source }, update: { catalogSyncedAt: observedAt, catalogEtag: payload.etag },
      create: { id: adapter.source, name: adapter.name, homepage: adapter.homepage, sourceType: "OFFICIAL",
        trustPolicy: "First-party model metadata. Exact revisions only.", catalogSyncedAt: observedAt, catalogEtag: payload.etag } });
    if (snapshot?.checksum === checksum) return { state: "unchanged" as const, discovered: 0 };
    const lab = await tx.lab.upsert({ where: { slug: adapter.lab.slug }, update: {}, create: adapter.lab });
    const exact = new Map<string, string>();
    let discovered = 0;
    for (const row of payload.rows) if ("revision" in row) {
      const result = await upsertModel(tx, adapter, row, lab.id, observedAt, checksum);
      exact.set(row.id, result.id);
      discovered += Number(result.created);
    }
    const aliases = payload.rows.flatMap(row => "revision" in row ? [] : [{
      id: row.id, target: row.target ?? null, modelVersionId: row.target ? exact.get(row.target) ?? null : null,
    }]);
    await tx.sourceSnapshot.create({ data: { sourceId: adapter.source, kind: "catalog",
      version: `${observedAt.toISOString()}/${checksum}`, checksum, observedAt, modelCount: payload.rows.length, aliases } });
    return { state: "applied" as const, discovered, exact: exact.size, aliases: aliases.length, checksum };
  }, { timeout: 120_000 });
}
