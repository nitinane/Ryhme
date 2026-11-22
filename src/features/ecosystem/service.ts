import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db/client";
import { offeringInclude } from "@/features/catalog/services/models";
import type { LabQuery, ProviderQuery } from "./query";

function literalSearch(q: string) {
  return { contains: q.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const };
}

function pagination(query: LabQuery, total: number) {
  const { page, limit } = query;
  return { page, limit, total, hasMore: page * limit < total };
}

export async function listLabs(query: LabQuery) {
  const db = getDb();
  const where = query.q ? { name: literalSearch(query.q) } : {};
  const [data, total] = await Promise.all([
    db.lab.findMany({ where, include: { _count: { select: { families: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }], skip: (query.page - 1) * query.limit, take: query.limit }),
    db.lab.count({ where }),
  ]);
  return { data, meta: pagination(query, total) };
}

export async function findLab(slug: string) {
  const db = getDb();
  const lab = await db.lab.findUnique({
    where: { slug },
    include: { families: {
      orderBy: [{ name: "asc" }, { id: "asc" }],
      include: { versions: {
        select: {
            id: true, slug: true, canonicalName: true, lifecycle: true, capabilities: true, releaseDate: true,
            _count: { select: { results: { where: { verifiedStatus: "VERIFIED", supersededAt: null } } } },
          offerings: { select: { provider: { select: { name: true, slug: true } } }, distinct: ["providerId"] },
        },
        orderBy: [{ canonicalName: "asc" }, { id: "asc" }],
      } },
    } },
  });
  if (!lab) return null;
  const sources = await db.sourceObservation.findMany({
    where: { entityType: "Lab", entityId: lab.id }, orderBy: [{ observedAt: "desc" }, { id: "asc" }],
  });
  return { ...lab, sources };
}

function offeringFilters(query: ProviderQuery): Prisma.OfferingWhereInput {
  return {
    availabilityStatus: query.availability,
    ...(query.capability ? { model: { capabilities: { array_contains: [query.capability] } } } : {}),
  };
}

export async function listProviders(query: ProviderQuery) {
  const db = getDb();
  const filter = offeringFilters(query);
  const matchingOffering = query.q ? { ...filter, AND: [
    { model: { canonicalName: literalSearch(query.q) } },
  ] } : filter;
  const where: Prisma.ProviderWhereInput = {
    ...(query.q ? { OR: [
      { name: literalSearch(query.q), ...(query.availability || query.capability ? { offerings: { some: filter } } : {}) },
      { offerings: { some: matchingOffering } },
    ] } : query.availability || query.capability ? { offerings: { some: filter } } : {}),
  };
  const [data, total] = await Promise.all([
    db.provider.findMany({ where,
      include: { _count: { select: { offerings: { where: filter } } } },
      orderBy: [{ name: "asc" }, { id: "asc" }], skip: (query.page - 1) * query.limit, take: query.limit }),
    db.provider.count({ where }),
  ]);
  return { data, meta: pagination(query, total) };
}

export async function findProvider(slug: string, query: ProviderQuery) {
  const db = getDb();
  const provider = await db.provider.findUnique({ where: { slug } });
  if (!provider) return null;
  const where: Prisma.OfferingWhereInput = {
    providerId: provider.id, ...offeringFilters(query),
    ...(query.q ? { AND: [{
      OR: [{ externalModelId: literalSearch(query.q) }, { model: { canonicalName: literalSearch(query.q) } }],
    }] } : {}),
  };
  const [offerings, total, sources] = await Promise.all([
    db.offering.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ availabilityStatus: "asc" }, { model: { canonicalName: "asc" } }, { id: "asc" }],
      include: { ...offeringInclude, model: { include: { family: { include: { lab: true } } } } },
    }),
    db.offering.count({ where }),
    db.sourceObservation.findMany({
      where: { entityType: "Provider", entityId: provider.id }, orderBy: [{ observedAt: "desc" }, { id: "asc" }],
    }),
  ]);
  return { ...provider, offerings, sources, meta: pagination(query, total) };
}
