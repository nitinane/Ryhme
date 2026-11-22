import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";
import { anthropicCatalog, geminiCatalog, huggingFaceCatalog, openaiCatalog, qwenCatalog } from "../src/ingestion/catalog-adapters";
import { localIntelligenceUrl, refreshCatalog } from "../src/ingestion/catalog-refresh";
import { ingestBenchmarkFeed, type BenchmarkFeed } from "../src/ingestion/benchmark-feed";
import { loadLatestBfcl } from "../src/ingestion/bfcl";
import { epochBenchmarkFeed } from "../src/ingestion/epoch-benchmarks";

const sources = {
  epoch: { host: "epoch.ai", minimum: 3, attribution: { id: "epoch-ai", name: "Epoch AI",
    homepage: "https://epoch.ai/benchmarks", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" } },
  bfcl: { host: "github.com", minimum: 2, attribution: { id: "berkeley-bfcl", name: "Berkeley Function Calling Leaderboard",
    homepage: "https://github.com/HuanzhiMao/BFCL-Result", license: "Apache-2.0",
    licenseUrl: "https://github.com/HuanzhiMao/BFCL-Result/blob/main/LICENSE" } },
} as const;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}

function adapter(name: string) {
  switch (name) {
    case "openai": return openaiCatalog(required("OPENAI_API_KEY"));
    case "anthropic": return anthropicCatalog(required("ANTHROPIC_API_KEY"));
    case "gemini": return geminiCatalog(required("GEMINI_API_KEY"));
    case "qwen": return qwenCatalog(required("DASHSCOPE_API_KEY"), required("QWEN_WORKSPACE_HOST"));
    case "huggingface": {
      const owner = required("HF_PUBLISHER");
      const lab = { slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).parse(required("HF_LAB_SLUG")),
        name: required("HF_LAB_NAME"), website: z.url({ protocol: /^https$/ }).parse(required("HF_LAB_WEBSITE")) };
      return huggingFaceCatalog(owner, lab, process.env.HF_TOKEN);
    }
    default: throw new Error("Select openai, anthropic, gemini, qwen, or huggingface.");
  }
}

async function refreshBenchmark(db: PrismaClient, name: string, file?: string, expected?: string) {
  if (!Object.hasOwn(sources, name)) throw new Error("Select a reviewed benchmark source: epoch or bfcl.");
  const source = sources[name as keyof typeof sources];
  const observedAt = new Date();
  let version: string;
  let feed: BenchmarkFeed;
  if (file) {
    const raw = await readFile(file);
    const checksum = createHash("sha256").update(raw).digest("hex");
    if (raw.length > 3_000_000 || expected !== checksum) throw new Error("Reviewed export size or checksum mismatch.");
    const { version: revision, feed: archive } = z.object({ version: z.string().min(1).max(200), feed: z.object({
      source: z.object({ id: z.string() }).passthrough(), benchmarks: z.array(z.object({ sourceUrl: z.string() }).passthrough()),
      evidence: z.array(z.object({ sourceUrl: z.string() }).passthrough()),
    }) }).parse(JSON.parse(raw.toString("utf8")));
    const allowed = (value: string) => {
      const url = new URL(value);
      return url.protocol === "https:" && (name === "epoch"
        ? [source.host, "logs.epoch.ai"].includes(url.hostname)
        : url.hostname === source.host && url.pathname.startsWith("/HuanzhiMao/BFCL-Result/") || url.hostname === "gorilla.cs.berkeley.edu");
    };
    if (archive.source.id !== source.attribution.id || ![...archive.benchmarks, ...archive.evidence].every(row => allowed(row.sourceUrl))) {
      throw new Error("Export does not identify the selected benchmark publisher.");
    }
    feed = { ...archive, source: source.attribution, checksum } as BenchmarkFeed;
    version = revision;
  } else if (name === "bfcl") {
    ({ feed, version } = await loadLatestBfcl());
  } else {
    feed = epochBenchmarkFeed();
    version = feed.checksum;
  }
  return db.$transaction(tx => ingestBenchmarkFeed(tx, feed, observedAt, true, source.minimum, version),
    { timeout: 60_000 });
}

const [kind, name, file, checksum, ...extra] = process.argv.slice(2);
const connectionString = localIntelligenceUrl(process.env.RYHME_INTELLIGENCE_DATABASE_URL);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }) });
try {
  if (!name || extra.length || !!file !== !!checksum || (kind === "catalog" && file)) throw new Error("Invalid refresh arguments.");
  const result = kind === "catalog" ? await refreshCatalog(db, adapter(name))
    : kind === "benchmark" ? await refreshBenchmark(db, name, file, checksum) : null;
  if (!result) throw new Error("Select catalog or benchmark.");
  console.log(JSON.stringify(result));
} catch (error) {
  // HTTP and schema failures may contain vendor response text or credentials. Keep CLI errors bounded.
  console.error(error instanceof z.ZodError ? "Invalid source payload." : error instanceof Error && !("code" in error)
    ? error.message : "Local intelligence refresh failed.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
