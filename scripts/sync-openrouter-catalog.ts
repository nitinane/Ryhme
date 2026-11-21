import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { neonDevelopmentUrls } from "../src/lib/config/neon";
import { catalogPlan, fetchCatalog, normalizeCatalog, syncCatalog } from "../src/ingestion/openrouter-catalog";

import { developmentTarget, lockCatalog, runCatalogSchedule, scheduledCatalogUrl } from "../src/ingestion/openrouter-schedule";

const development = { host: "ep-calm-term-a1y5fnth.ap-southeast-1.aws.neon.tech", database: "neondb", role: "neondb_owner" };

const started = Date.now();

async function run() {
  const [flag, approvedHash, ...extra] = process.argv.slice(2);
  if (flag === "--scheduled" && !approvedHash) {
    const db = new PrismaClient({ adapter: new PrismaPg({
      connectionString: scheduledCatalogUrl(process.env), connectionTimeoutMillis: 5_000,
    }) });
    try {
      const result = await runCatalogSchedule(db, developmentTarget);
      console.log(JSON.stringify({ mode: "scheduled", ...result, durationMs: Date.now() - started }));
    } finally {
      await db.$disconnect();
    }
    return;
  }
  if ((flag && (flag !== "--apply" || !/^[a-f0-9]{64}$/.test(approvedHash ?? ""))) || extra.length) {
    throw new Error("Use the default preview or --apply followed by the approved preview hash.");
  }
  const { rows, seenIds, ...discovery } = normalizeCatalog(await fetchCatalog());
  if (!rows.length) throw new Error("No importable catalog listings.");
  const observedAt = new Date(new Date().toISOString().slice(0, 10));
  nextEnv.loadEnvConfig(process.cwd(), true);
  const direct = neonDevelopmentUrls(process.env, development).find(({ key }) => key === "DIRECT_URL")!;
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: direct.url, connectionTimeoutMillis: 5_000 }) });
  try {
    const result = await db.$transaction(async (tx) => {
      if (!flag) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      else await lockCatalog(tx);
      const [target] = await tx.$queryRaw<{ database: string; role: string }[]>`
        SELECT current_database() AS database, current_user AS role`;
      if (target?.database !== development.database || target.role !== development.role) {
        throw new Error("Development database identity mismatch.");
      }
      const plan = await catalogPlan(tx, rows, observedAt);
      const hash = createHash("sha256").update(JSON.stringify({ observedAt, discovery, seenIds, plan })).digest("hex");
      if (flag) {
        if (hash !== approvedHash) throw new Error("The import plan changed. Generate a fresh preview for approval.");
        await syncCatalog(tx, plan, observedAt);
      }
      return { mode: flag ? "applied" : "read-only", observedAt, ...discovery, ...plan.stats, hash };
    }, { isolationLevel: "Serializable", timeout: 180_000 });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await db.$disconnect();
  }
}

await run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (process.argv[2] === "--scheduled") console.error(`Scheduled catalog sync failed after ${Date.now() - started} ms.`);
  console.error(/^(OpenRouter |Use the default|No importable|Supply the direct|DATABASE_URL does not match|DIRECT_URL does not match|Development database identity|The import plan changed|Catalog scheduler is disabled|Catalog sync is already running)/.test(message)
    ? message : "Catalog sync failed. Check catalog response, target connectivity, and database schema.");
  process.exitCode = 1;
});
