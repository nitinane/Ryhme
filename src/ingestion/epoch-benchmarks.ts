import { Prisma } from "../generated/prisma/client";
import type { BenchmarkFeed } from "./benchmark-feed";
import snapshot from "./data/epoch-2026-11.json";
import { stableSlug } from "./openrouter-catalog";

const protocols = {
  "gpqa_diamond.csv": {
    slug: "gpqa-diamond-epoch-2025-01-27", name: "GPQA Diamond (Epoch AI)", category: "reasoning",
    version: "GPQA Diamond / Epoch AI January 2025 cohort",
    methodology: "Epoch AI's mean accuracy on the GPQA Diamond science-question subset using its Inspect evaluation protocol. This cohort is limited to reviewed checkpoints in the January 27 UTC run batch.",
    sourceUrl: "https://epoch.ai/benchmarks/gpqa-diamond",
    metricName: "Mean accuracy",
  },
  "otis_mock_aime_2024_2025.csv": {
    slug: "otis-mock-aime-epoch-2025-02-25", name: "OTIS Mock AIME 2024–2025 (Epoch AI)", category: "mathematics",
    version: "OTIS Mock AIME 2024–2025 / Epoch AI February 2025 cohort",
    methodology: "Epoch AI's mean accuracy on the 2024 and 2025 OTIS mock contests using its Inspect evaluation protocol. This cohort is limited to reviewed checkpoints in the February 25 UTC run batch.",
    sourceUrl: "https://epoch.ai/benchmarks/otis-mock-aime-2024-2025",
    metricName: "Mean accuracy",
  },
} satisfies Record<string, Omit<BenchmarkFeed["benchmarks"][number], "direction" | "unit">>;

export function epochBenchmarkFeed(): BenchmarkFeed {
  const benchmarks: BenchmarkFeed["benchmarks"] = [];
  const evidence: BenchmarkFeed["evidence"] = [];
  for (const cohort of snapshot.cohorts) {
    const protocol = protocols[cohort.file as keyof typeof protocols];
    if (!protocol) throw new Error("Unknown Epoch benchmark protocol.");
    benchmarks.push({ ...protocol, unit: "%", direction: "HIGHER" });
    for (const row of cohort.rows) {
      const score = new Prisma.Decimal(row.scoreFraction);
      if (!score.isFinite() || score.lt(0) || score.gt(1)) throw new Error("Epoch accuracy outside its units.");
      evidence.push({
        benchmarkSlug: protocol.slug, modelSlug: stableSlug(row.checkpoint),
        score: score.times(100).toFixed(8), evaluatedAt: cohort.date, publishedAt: null,
        methodologyVersion: protocol.version, evaluationOrigin: "INDEPENDENT",
        datasetRevision: cohort.file,
        evaluationConfig: "Epoch AI Inspect; zero-shot chain-of-thought; API-default temperature; selected same-day runs",
        evaluationKey: `epoch-${protocol.slug}-${snapshot.archiveSha256.slice(0, 12)}`, sourceUrl: row.sourceUrl,
      });
    }
  }
  return {
    source: { id: "epoch-ai", name: "Epoch AI", homepage: "https://epoch.ai/benchmarks",
      license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/" },
    benchmarks, evidence, checksum: snapshot.archiveSha256,
  };
}

export const epochExcluded = snapshot.cohorts.map(({ file, unmappedModels }) => ({ file, count: unmappedModels.length }));
