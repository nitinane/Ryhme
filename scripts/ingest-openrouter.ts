import nextEnv from "@next/env";
import { getDb } from "../src/lib/db/client";
import { observeOpenRouter, saveOpenRouterListing } from "../src/ingestion/openrouter";

nextEnv.loadEnvConfig(process.cwd(), true);

async function ingest() {
  const observedAt = await observeOpenRouter();
  const db = getDb();
  try {
    await db.$transaction((tx) => saveOpenRouterListing(tx, observedAt));
    console.log("Verified OpenRouter listing saved.");
  } finally {
    await db.$disconnect();
  }
}

ingest().catch(() => {
  console.error("OpenRouter ingestion failed. Check the public metadata endpoint and the seeded development database.");
  process.exitCode = 1;
});
