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

// V4 adds web-search and memory scoring. Do not mix it with the historical V3 cohorts.
export function parseBfclV4(csv: string, date: string, commit: string): BenchmarkFeed {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "2025-12-16" || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error("Unreviewed BFCL V4 archive identity.");
  }
  const [first, ...lines] = csv.trim().split(/\r?\n/);
  const headers = cells(first.replace(/^\uFEFF/, ""));
  const columns = ["Model", "Organization", "Overall Acc", "Multi Turn Long Context", "Web Search Acc", "Memory Acc"];
  if (!lines.length || lines.length > 500 || columns.some(column => !headers.includes(column))) throw new Error("Unsupported BFCL V4 export.");
  const definitions = [
    { slug: "bfcl-v4-function-calling", name: "BFCL V4 function calling", category: "tool-use", metricName: "Overall accuracy", column: "Overall Acc" },
    { slug: "bfcl-v4-long-context", name: "BFCL V4 long-context tool use", category: "long-context", metricName: "Multi-turn long-context accuracy", column: "Multi Turn Long Context" },
  ] as const;
  const sourceUrl = `${archive}/blob/${commit}/${date}/score/data_overall.csv`;
  const evidence: BenchmarkFeed["evidence"] = [];
  for (const line of lines) {
    const row = cells(line);
    if (row.length !== headers.length) throw new Error("Unexpected BFCL V4 column count.");
    const model = /^([a-z0-9._-]+) \((FC|Prompt)\)$/i.exec(row[headers.indexOf("Model")]);
    if (!model) continue;
    const externalId = model[1].toLowerCase();
    const organization = row[headers.indexOf("Organization")];
    const namespace = organization === "OpenAI" && /-\d{4}-\d{2}-\d{2}$/.test(externalId) ? "openai"
      : organization === "Anthropic" && /^claude-.*-\d{8}$/.test(externalId) ? "anthropic" : null;
    if (!namespace) continue;
    for (const definition of definitions) {
      const value = row[headers.indexOf(definition.column)];
      if (value === "N/A" || value === "") continue;
      if (!/^\d{1,3}(?:\.\d{1,8})?%$/.test(value)) throw new Error("Unexpected BFCL V4 score format.");
      evidence.push({ benchmarkSlug: definition.slug,
        modelSlug: reviewedBfclSlug(namespace, externalId),
        checkpoint: { sourceId: `${namespace}-discovery`, externalId, revision: externalId },
        score: value.slice(0, -1), evaluatedAt: null, publishedAt: date, evaluationOrigin: "INDEPENDENT",
        methodologyVersion: "BFCL V4", datasetRevision: `BFCL V4 archive ${date}`,
        evaluationConfig: model[2] === "FC" ? "Native function calling" : "Prompt-based function calling",
        evaluationKey: `bfcl-v4-${date}-${model[2].toLowerCase()}`, sourceUrl });
    }
  }
  return {
    source: { id: "berkeley-bfcl", name: "Berkeley Function Calling Leaderboard", homepage: archive,
      license: "Apache-2.0", licenseUrl: `${archive}/blob/${commit}/LICENSE` },
    benchmarks: definitions.map(({ slug, name, category, metricName }) => ({
      slug, name, category, metricName, unit: "%", direction: "HIGHER", version: "BFCL V4",
      methodology: category === "tool-use" ? "Overall BFCL V4 function-calling suite accuracy, including web search and memory."
        : "Accuracy on BFCL V4 multi-turn tool use under long context.",
      sourceUrl: "https://gorilla.cs.berkeley.edu/leaderboard",
    })),
    evidence,
    checksum: createHash("sha256").update(csv).digest("hex"),
  };
}

function reviewedBfclSlug(namespace: string, id: string) {
  if (namespace === "openai" && /^gpt-4\.1(?:-mini|-nano)?-2025-04-14$/.test(id)) return id.replace(".", "-");
  return stableSlug(`${namespace}/${id}`);
}

export async function loadLatestBfcl(fetcher = fetch) {
  const api = "https://api.github.com/repos/HuanzhiMao/BFCL-Result";
  const load = async (url: string) => {
    const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`BFCL archive unavailable (HTTP ${response.status}).`);
    return response;
  };
  const head = await (await load(`${api}/commits/main`)).json() as { sha?: string };
  if (!head.sha || !/^[a-f0-9]{40}$/.test(head.sha)) throw new Error("Invalid BFCL archive revision.");
  const index = await (await load(`${api}/git/trees/${head.sha}`)).json() as { truncated?: boolean; tree?: { path: string; type: string }[] };
  if (index.truncated || !Array.isArray(index.tree)) throw new Error("Incomplete BFCL archive index.");
  const date = index.tree.filter(row => row.type === "tree" && /^\d{4}-\d{2}-\d{2}$/.test(row.path))
    .map(row => row.path).sort().at(-1);
  if (!date) throw new Error("No dated BFCL archive.");
  const csv = await (await load(`https://raw.githubusercontent.com/HuanzhiMao/BFCL-Result/${head.sha}/${date}/score/data_overall.csv`)).text();
  if (csv.length > 350_000) throw new Error("BFCL archive exceeds the expected size.");
  return { feed: parseBfclV4(csv, date, head.sha), version: `bfcl-v4-${date}` };
}
