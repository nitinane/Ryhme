CREATE INDEX "BenchmarkResult_cohort_idx" ON "BenchmarkResult" (
  "benchmarkId", "verifiedStatus", "sourceId", "evaluationKey", "methodologyVersion", "evaluatedAt"
);
