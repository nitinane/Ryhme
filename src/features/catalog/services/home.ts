import "server-only";
import type { BenchmarkPoint } from "@/features/benchmarks/chart-data";
import { date } from "../presentation";
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

export async function homeTokenRates(models: BenchmarkPoint[]) {
  if (!models.length) return null;
  const offerings = await getDb().offering.findMany({
    where: { model: { slug: { in: models.map(({ slug }) => slug) } }, availabilityStatus: "LISTED" },
    select: {
      provider: { select: { name: true, slug: true } },
      model: { select: { slug: true } },
      prices: {
        where: { currency: "USD" },
        select: { inputPerMillion: true, observedAt: true, sourceUrl: true, source: { select: { name: true } } },
        take: 1, orderBy: [{ observedAt: "desc" }, { id: "desc" }],
      },
    },
    orderBy: [{ providerId: "asc" }, { id: "asc" }],
  });
  const quotes = new Map<string, { provider: string; points: BenchmarkPoint[] }>();
  for (const { provider, model, prices: [price] } of offerings) {
    if (price?.inputPerMillion == null) continue;
    const group = quotes.get(provider.slug) ?? { provider: provider.name, points: [] };
    quotes.set(provider.slug, group);
    if (group.points.some(({ slug }) => slug === model.slug)) continue;
    const modelPoint = models.find(({ slug }) => slug === model.slug)!;
    group.points.push({
      slug: modelPoint.slug, name: modelPoint.name, labName: modelPoint.labName, labSlug: modelPoint.labSlug,
      score: price.inputPerMillion.toString(), sourceUrl: price.sourceUrl,
      evidence: `${provider.name} · ${price.source.name} · Observed ${date(price.observedAt)}.`,
    });
  }
  const group = [...quotes.values()].sort((a, b) => b.points.length - a.points.length)[0];
  if (!group) return null;
  return { ...group, points: group.points.sort((a, b) => Number(a.score) - Number(b.score)) };
}
