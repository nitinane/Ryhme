import nextEnv from "@next/env";
import pg from "pg";
import { neonDevelopmentUrls } from "../src/lib/config/neon";

const [host, database, role] = process.argv.slice(2);
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

async function verify() {
  let urls;
  try {
    urls = neonDevelopmentUrls(process.env, { host, database, role });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Neon development configuration check failed.");
    process.exitCode = 1;
    return;
  }

  for (const { key, url } of urls) {
    const client = new pg.Client({
      connectionString: url,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 4_000,
      query_timeout: 7_000,
    });
    try {
      await client.connect();
      const { rows } = await client.query("SELECT current_database() AS database, current_user AS role");
      if (rows[0]?.database !== database || rows[0]?.role !== role) throw new Error("Database identity mismatch");
      console.log(`${key}: endpoint, database, and role matched using verified TLS.`);
    } catch {
      console.error(`${key}: read-only connection or identity check failed.`);
      process.exitCode = 1;
      return;
    } finally {
      await client.end().catch(() => {});
    }
  }
}

await verify();
