import { createHash } from "node:crypto";
import type { BenchmarkFeed } from "./benchmark-feed";
import { stableSlug } from "./openrouter-catalog";

const archive = "https://github.com/HuanzhiMao/BFCL-Result";
const revision = "cadd76a8dc62984e7bf15ecaf358f070bae745cc";
const publishedAt = "2025-03-17";
const filename = `${publishedAt}/score/data_overall.csv`;
const methodologyUrl = "https://gorilla.cs.berkeley.edu/blogs/13_bfcl_v3_multi_turn.html";
const resultUrl = `${archive}/blob/${revision}/${filename}`;
const downloadUrl = `https://raw.githubusercontent.com/HuanzhiMao/BFCL-Result/${revision}/${filename}`;

const checkpointSlugs = new Map([
  ["GPT-4o-2024-11-20", stableSlug("openai/gpt-4o-2024-11-20")],
  ["GPT-4o-mini-2024-07-18", stableSlug("openai/gpt-4o-mini-2024-07-18")],
  ["Qwen2.5-72B-Instruct", stableSlug("qwen/qwen-2.5-72b-instruct")],
  ["Gemma-3-27b-it", "gemma-3-27b-it"],
]);

const metrics = [
  { column: "Overall Acc", slug: "bfcl-v3-function-calling", name: "BFCL V3 function calling",
    category: "instruction-following", metricName: "Function-calling accuracy",
    methodology: "Berkeley's BFCL V3 overall function-calling score combines the project's single-turn, multi-turn, and relevance tests. It measures adherence to tool-call instructions." },
  { column: "Multi Turn Long Context", slug: "bfcl-v3-long-context", name: "BFCL V3 long-context tool use",
    category: "long-context", metricName: "Multi-turn long-context accuracy",
    methodology: "Accuracy on Berkeley's BFCL V3 multi-turn long-context subset, which tests tool use across extended conversations." },
] as const;

function cells(line: string) {
  const parts = [...line.matchAll(/(?:^|,)("(?:[^"]|"")*"|[^",]*)(?=,|$)/g)];
  if (parts.map(([token]) => token).join("") !== line) throw new Error("Malformed BFCL archive CSV.");
  return parts.map(([, value]) => value.startsWith('"') ? value.slice(1, -1).replaceAll('""', '"') : value);
}

export function parseBfcl(csv: string): BenchmarkFeed {
  const [first, ...lines] = csv.trim().split(/\r?\n/);
  const headings = cells(first);
  const modelColumn = headings.indexOf("Model");
  if (!lines.length || lines.length > 500 || modelColumn < 0 || new Set(headings).size !== headings.length
    || metrics.some(({ column }) => !headings.includes(column))) throw new Error("Unsupported BFCL archive format.");

  const evidence: BenchmarkFeed["evidence"] = [];
  for (const line of lines) {
    const row = cells(line);
    if (row.length !== headings.length) throw new Error("Unexpected BFCL column count.");
    const identified = /^(.*) \((FC|Prompt)\)$/.exec(row[modelColumn]);
    if (!identified) continue;
    const [, name, format] = identified;
    const modelSlug = checkpointSlugs.get(name) ?? null;
    for (const metric of metrics) {
      const value = row[headings.indexOf(metric.column)];
      if (value === "N/A" || value === "") continue;
      if (!/^\d{1,3}(?:\.\d{1,8})?%$/.test(value)) throw new Error("Unexpected BFCL score format.");
      evidence.push({
        benchmarkSlug: metric.slug, modelSlug, score: value.slice(0, -1),
        evaluatedAt: null, publishedAt, evaluationOrigin: "INDEPENDENT", methodologyVersion: "BFCL V3",
        datasetRevision: `BFCL V3 archive ${revision}`,
        evaluationConfig: format === "FC" ? "Native function calling" : "Prompt-based function calling",
        evaluationKey: `bfcl-v3-${publishedAt}-${revision.slice(0, 12)}-${format.toLowerCase()}`,
        sourceUrl: resultUrl,
      });
    }
  }

  return {
    source: { id: "berkeley-bfcl", name: "Berkeley Function Calling Leaderboard", homepage: archive,
      license: "Apache-2.0", licenseUrl: `${archive}/blob/${revision}/LICENSE` },
    benchmarks: metrics.map(({ slug, name, category, metricName, methodology }) => ({
      slug, name, category, metricName, methodology, unit: "%", direction: "HIGHER", version: "BFCL V3", sourceUrl: methodologyUrl,
    })),
    evidence,
    checksum: createHash("sha256").update(csv).digest("hex"),
  };
}

export async function loadBfcl(fetcher = fetch) {
  const response = await fetcher(downloadUrl, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`BFCL archive unavailable (HTTP ${response.status}).`);
  const csv = await response.text();
  if (csv.length > 350_000) throw new Error("BFCL archive exceeds the expected size.");
  return parseBfcl(csv);
}
