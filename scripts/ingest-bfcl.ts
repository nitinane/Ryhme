import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestBenchmarkFeed } from "../src/ingestion/benchmark-feed";
import { loadBfcl } from "../src/ingestion/bfcl";

async function run() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== "--apply")) throw new Error();
  const url = URL.parse(process.env.BENCHMARK_DATABASE_URL ?? "");
  if (!url || url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1"
    || !/^\/ryhme(?:_[a-z0-9_]+)?$/.test(url.pathname) || url.search || url.hash) {
    console.error("Configure BENCHMARK_DATABASE_URL for a local loopback Ryhme database.");
    process.exitCode = 1;
    return;
  }
  const feed = await loadBfcl();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href, connectionTimeoutMillis: 5000 }) });
  try {
    const stats = await db.$transaction(async (tx) => {
      if (!args.length) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return ingestBenchmarkFeed(tx, feed, new Date(), args.length === 1);
    }, { isolationLevel: "Serializable", timeout: 45_000 });
    console.log(JSON.stringify({ mode: args.length ? "applied" : "read-only", ...stats }));
  } finally { await db.$disconnect(); }
}

await run().catch(() => {
  console.error("BFCL import stopped. Check archive availability, migration status, and immutable benchmark identities.");
  process.exitCode = 1;
});
