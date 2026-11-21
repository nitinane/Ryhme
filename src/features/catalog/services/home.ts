import "server-only";
import { getDb } from "@/lib/db/client";

export async function homeCatalog() {
  try {
    const db = getDb();
    const [models, labs, providers, benchmarks, evidence] = await Promise.all([
      db.modelVersion.count(), db.lab.count(), db.provider.count(),
      db.benchmark.count({ where: { results: { some: { verifiedStatus: "VERIFIED" } } } }),
      db.sourceObservation.findMany({
        where: { entityType: "ModelVersion", field: "canonicalName", verificationStatus: "VERIFIED" },
        select: { entityId: true }, distinct: ["entityId"],
      }),
    ]);
    const featured = await db.modelVersion.findMany({
      where: { id: { in: evidence.map(({ entityId }) => entityId) }, lifecycle: { not: "RETIRED" } },
      select: { id: true, slug: true, canonicalName: true, contextTokens: true, lifecycle: true,
        family: { select: { lab: { select: { name: true } } } } },
      orderBy: [{ releaseDate: { sort: "desc", nulls: "last" } }, { canonicalName: "asc" }, { id: "asc" }],
      take: 3,
    });
    return { models, labs, providers, benchmarks, featured };
  } catch {
    return null;
  }
}
