import "server-only";
import { getDb } from "@/lib/db/client";

export async function homeCatalog() {
  try {
    const db = getDb();
    const [models, labs, providers, benchmarks, latest, source] = await Promise.all([
      db.modelVersion.count(), db.lab.count(), db.provider.count(),
      db.benchmark.count({ where: { results: { some: { verifiedStatus: "VERIFIED" } } } }),
      db.$queryRaw<{
        id: string; slug: string; canonicalName: string; contextTokens: number | null;
        createdAt: Date; labName: string;
      }[]>`
        SELECT id, slug, "canonicalName", "contextTokens", "createdAt", "labName" FROM (
          SELECT DISTINCT ON (l.id) m.id, m.slug, m."canonicalName", m."contextTokens", m."createdAt", l.name AS "labName"
          FROM "ModelVersion" m JOIN "ModelFamily" f ON f.id = m."familyId" JOIN "Lab" l ON l.id = f."labId"
          WHERE m.lifecycle <> 'RETIRED'
          ORDER BY l.id, m."createdAt" DESC, m."canonicalName", m.id
        ) latest ORDER BY "createdAt" DESC, "canonicalName", id LIMIT 6
      `,
      db.dataSource.findUnique({ where: { id: "openrouter" }, select: { catalogSyncedAt: true, homepage: true } }),
    ]);
    return { models, labs, providers, benchmarks, latest, source };
  } catch {
    return null;
  }
}
