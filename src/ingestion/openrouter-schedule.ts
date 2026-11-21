import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { neonDevelopmentUrl } from "../lib/config/neon";
import { catalogPlan, catalogUrl, fetchCatalog, normalizeCatalog, openRouterSourceId, syncCatalog } from "./openrouter-catalog";

export const developmentTarget = {
  host: "ep-calm-term-a1y5fnth.ap-southeast-1.aws.neon.tech",
  database: "neondb",
  role: "ryhme_catalog_sync",
};

export function scheduledCatalogUrl(env: Record<string, string | undefined>) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REPOSITORY?.toLowerCase() !== "nitinane/ryhme"
    || env.GITHUB_REF !== "refs/heads/main" || !["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME ?? "")
    || env.RYHME_CATALOG_SYNC_ENABLED !== "true") {
    throw new Error("Catalog scheduler is disabled outside the approved repository workflow.");
  }
  return neonDevelopmentUrl(env, developmentTarget, "DIRECT_URL").url;
}

export async function lockCatalog(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(2090871601, 1) AS acquired`;
  if (!row.acquired) throw new Error("Catalog sync is already running.");
}

const gracePeriod = 24 * 60 * 60 * 1_000;

export async function runCatalogSchedule(
  db: PrismaClient,
  expected: { database: string; role: string },
  loadCatalog = fetchCatalog,
  now = () => new Date(),
) {
  return db.$transaction(async (tx) => {
    const [identity] = await tx.$queryRaw<{ database: string; role: string }[]>`
      SELECT current_database() AS database, current_user AS role`;
    if (identity?.database !== expected.database || identity.role !== expected.role) {
      throw new Error("Development database identity mismatch.");
    }
    await lockCatalog(tx);
    await tx.$executeRaw`SET LOCAL statement_timeout = '15s'`;
    const { rows, seenIds, ...discovery } = normalizeCatalog(await loadCatalog());
    if (!rows.length) throw new Error("No importable catalog listings.");
    const observedAt = now();
    const plan = await catalogPlan(tx, rows, observedAt, true);
    await syncCatalog(tx, plan, observedAt, true);

    const provider = { provider: { slug: "openrouter" }, sourceId: openRouterSourceId, sourceUrl: catalogUrl };
    const missing = {
      ...provider,
      externalModelId: { notIn: seenIds },
      availabilityStatus: "LISTED" as const,
      observedAt: { lt: observedAt },
    };
    const activeCount = await tx.offering.count({ where: { ...provider, availabilityStatus: "LISTED" } });
    const missingCount = await tx.offering.count({ where: missing });
    // A sharply reduced or ambiguous feed can refresh records it includes. Absence in it is weak evidence.
    const removalDeferred = discovery.duplicateIds > 0 || plan.stats.conflicts > 0
      || seenIds.length < discovery.discovered * .8 || missingCount > activeCount * .25 && missingCount > 1;
    let newlyMissing = 0;
    let unavailable = 0;
    if (!removalDeferred) {
      newlyMissing = (await tx.offering.updateMany({
        where: { ...missing, catalogMissingSince: null },
        data: { catalogMissingSince: observedAt },
      })).count;
      unavailable = (await tx.offering.updateMany({
        where: { ...missing, catalogMissingSince: { lte: new Date(+observedAt - gracePeriod) } },
        data: { availabilityStatus: "UNAVAILABLE" },
      })).count;
    }
    await tx.dataSource.update({
      where: { id: openRouterSourceId }, data: { catalogSyncedAt: observedAt },
    });
    return { ...discovery, ...plan.stats, newlyMissing, unavailable, removalDeferred, observedAt };
  }, { timeout: 180_000 });
}
