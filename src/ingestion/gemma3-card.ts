import { createHash } from "node:crypto";
import type { BenchmarkFeed } from "./benchmark-feed";
import { stableSlug } from "./openrouter-catalog";

const repository = "https://github.com/google-gemma/docs";
const revision = "9db9d497e046d34c68925f80a0672b3d1fe690dd";
const path = "docs/models/gemma-3/index.md";
const sourceUrl = `${repository}/blob/${revision}/${path}`;
const downloadUrl = `https://raw.githubusercontent.com/google-gemma/docs/${revision}/${path}`;
const release = "Gemma 3 model card";
const cohorts = [
  {
    slug: "mmmu-validation-gemma3-it", name: "MMMU validation (Gemma 3 IT)", category: "vision-multimodal",
    metricName: "Multimodal validation accuracy", methodology: "Google DeepMind's MMMU validation evaluation of Gemma 3 instruction-tuned checkpoints. The model card does not specify the shot count.",
    version: "Original MMMU, validation split", section: "Multimodal", metric: "MMMU (val)",
    columns: ["4B", "12B", "27B"], shots: null,
    datasetRevision: "Original MMMU / validation split; artifact revision unreported",
    evaluationConfig: "Gemma 3 IT; MMMU validation; shot count unreported",
  },
  {
    slug: "mmlu-pro-gemma3-it-zero-shot", name: "MMLU-Pro zero-shot (Gemma 3 IT)", category: "general-knowledge",
    metricName: "MMLU-Pro accuracy", methodology: "Google DeepMind's zero-shot MMLU-Pro evaluation of Gemma 3 instruction-tuned checkpoints across multiple academic disciplines.",
    version: "MMLU-Pro, Google DeepMind protocol", section: "STEM and code", metric: "MMLU (Pro)",
    columns: ["1B", "4B", "12B", "27B"], shots: "0-shot",
    datasetRevision: "MMLU-Pro; artifact revision unreported",
    evaluationConfig: "Gemma 3 IT; zero-shot; further settings unreported",
  },
] as const;

function fields(line: string) {
  return line.trim().slice(1, -1).split("|").map((field) => field.trim());
}

export function parseGemma3Card(markdown: string): BenchmarkFeed {
  const evidence: BenchmarkFeed["evidence"] = [];
  const benchmarks: BenchmarkFeed["benchmarks"] = [];
  for (const cohort of cohorts) {
    const lines = markdown.split(/\r?\n/);
    const section = lines.indexOf(`##### ${cohort.section}`);
    if (section < 0) throw new Error("Expected Gemma 3 model card section missing.");
    const end = lines.findIndex((line, index) => index > section && /^#{1,6} /.test(line));
    const table = lines.slice(section + 1, end < 0 ? undefined : end);
    const expected = ["Benchmark", ...(cohort.shots ? ["n-shot"] : []), ...cohort.columns.map(size => `Gemma 3 IT ${size}`)];
    const headings = table.findIndex(line => line.trim().startsWith("|") && JSON.stringify(fields(line)) === JSON.stringify(expected));
    if (headings < 0) throw new Error("Expected instruction-tuned checkpoint columns missing.");
    const rows: string[][] = [];
    for (const line of table.slice(headings + 2)) {
      if (!line.trim().startsWith("|")) break;
      const row = fields(line);
      const name = row[0].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      if (name === cohort.metric) rows.push(row);
    }
    const [row] = rows;
    if (rows.length !== 1 || row.length !== expected.length || (cohort.shots && row[1] !== cohort.shots)) {
      throw new Error("Ambiguous Gemma 3 metric row or evaluation configuration.");
    }
    const anchor = cohort.section.toLowerCase().replaceAll(" ", "-");
    const evidenceUrl = `${sourceUrl}#${anchor}`;
    const { slug, name, category, metricName, methodology, version } = cohort;
    benchmarks.push({ slug, name, category, metricName, methodology, version, unit: "%", direction: "HIGHER", sourceUrl: evidenceUrl });
    for (const [index, size] of cohort.columns.entries()) {
      const score = row[index + (cohort.shots ? 2 : 1)];
      if (score === "" || score === "-" || score === "N/A") continue;
      if (!/^\d{1,3}(?:\.\d{1,8})?$/.test(score)) throw new Error("Unexpected Gemma 3 score.");
      evidence.push({
        benchmarkSlug: slug, modelSlug: size === "27B" ? "gemma-3-27b-it" : stableSlug(`google/gemma-3-${size.toLowerCase()}-it`),
        score, evaluatedAt: null, publishedAt: null, evaluationOrigin: "PUBLISHER",
        methodologyVersion: release, datasetRevision: cohort.datasetRevision, evaluationConfig: cohort.evaluationConfig,
        evaluationKey: `gemma3-it-${revision.slice(0, 12)}-${slug}`, sourceUrl: evidenceUrl,
      });
    }
  }
  return {
    source: { id: "google-gemma-model-card", name: "Google DeepMind Gemma 3 model card", homepage: sourceUrl,
      license: "Apache-2.0", licenseUrl: `${repository}/blob/${revision}/LICENSE` },
    benchmarks, evidence, checksum: createHash("sha256").update(markdown).digest("hex"),
  };
}

export async function loadGemma3Card(fetcher = fetch) {
  const response = await fetcher(downloadUrl, { redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Gemma 3 model card unavailable (HTTP ${response.status}).`);
  const markdown = await response.text();
  if (markdown.length > 200_000) throw new Error("Gemma 3 model card exceeds the expected size.");
  return parseGemma3Card(markdown);
}
