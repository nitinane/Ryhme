import Link from "next/link";
import type { Metadata } from "next";
import { rankingQuery } from "@/features/benchmarks/query";
import { rankings } from "@/features/benchmarks/service";
import { SourceLink } from "@/features/catalog/components/source-link";
import { date } from "@/features/catalog/presentation";
import { BenchmarkBars } from "@/features/benchmarks/components/benchmark-bars";
import { RankingControls, rankingFilters } from "@/features/benchmarks/components/ranking-controls";
import { scoreLabel } from "@/features/benchmarks/chart-data";

export const metadata: Metadata = { title: "Benchmark rankings | Ryhme" };

export default async function RankingsPage({ searchParams }: PageProps<"/rankings">) {
  const raw = await searchParams;
  const input = rankingQuery.safeParse(raw);
  if (!input.success) return <main id="main-content" className="frame page"><h1>Benchmark rankings</h1>
    <p className="panel my-4" role="alert">Invalid ranking filters. <Link className="text-link" href="/rankings">Reset filters</Link></p>
  </main>;
  const query = input.data;
  const results = await rankings(query);
  const { benchmark, cohorts, cohort, data, meta } = results;
  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
    params.set("page", String(page));
    return `/rankings?${params}`;
  };
  return <main id="main-content" tabIndex={-1} className="frame page">
    <header className="page-heading"><h1>Benchmark rankings</h1><p>Compare model versions in the same published evaluation.</p></header>
    <div className="analysis-workspace">
    <RankingControls action="/rankings" options={results} query={query} />
    {!benchmark || !cohort ? <section className="panel mt-5"><h2>No verified benchmark coverage</h2>
      <p className="muted mt-2">Choose a category or benchmark with published results.</p>
      <Link className="text-link mt-2 inline-block" href="/rankings">Browse available benchmarks</Link>
    </section> : <>
      <div className="ranking-insights">
      <BenchmarkBars key={cohort.id} title="Ranked scores" metric={benchmark.metricName} unit={benchmark.unit}
        direction={benchmark.direction} methodology={benchmark.methodology} evidenceDate={date(cohort.evaluatedAt)}
        points={data} />
      <section className="evidence-panel" aria-labelledby="benchmark-heading">
        <h2 id="benchmark-heading">{benchmark.name}</h2>
        <p className="mt-2">{benchmark.methodology}</p>
        <p className="muted mt-2">{benchmark.metricName} ({benchmark.unit}) · {benchmark.direction === "HIGHER" ? "Higher is better" : "Lower is better"}</p>
        <p className="muted">Evaluation date {date(cohort.evaluatedAt)} · {cohort.methodologyVersion ?? benchmark.version ?? "Methodology version unknown"}</p>
        <p className="mt-2"><SourceLink url={benchmark.sourceUrl}>{benchmark.source.name} benchmark source</SourceLink></p>
        {cohorts.length > 1 && <nav aria-label="Evaluation cohorts" className="mt-3 flex flex-wrap gap-2">{cohorts.map((item) => {
          const params = rankingFilters(query);
          params.set("category", benchmark.category);
          params.set("benchmark", benchmark.slug);
          params.set("cohort", item.id);
          return <Link className="button" key={item.id} aria-current={item.id === cohort.id ? "page" : undefined}
            href={`/rankings?${params}`}>
            {item.methodologyVersion ?? item.evaluationKey} · {date(item.evaluatedAt)}
          </Link>
        })}</nav>}
      </section>
      </div>
      <p className="muted my-4" role="status">{meta.total} scored · {meta.eligible - meta.total} without a comparable score</p>
      {meta.total === 1 && <p className="muted mb-4">Only one comparable score is available for these filters.</p>}
      {data.length === 0 ? <section className="panel"><h2>No comparable scores on this page</h2>
        <p className="muted mt-2">Try another provider, benchmark, or page.</p></section> :
        <div className="matrix-scroll" role="region" aria-label="Benchmark leaderboard" tabIndex={0}>
          <table className="matrix leaderboard">
            <caption className="sr-only">{benchmark.name} results</caption>
            <thead><tr><th scope="col">Rank</th><th scope="col">Model version</th><th scope="col">Score</th><th scope="col">Evidence</th></tr></thead>
            <tbody>{data.map((row) => <tr key={row.slug}>
              <th scope="row">{row.rank}</th>
              <td><Link className="text-link" href={`/models/${row.slug}`}>{row.name}</Link><p className="muted text-sm">{row.labName}</p></td>
              <td>{scoreLabel(row.score, benchmark.unit)}</td>
              <td><SourceLink url={row.sourceUrl}>Result source</SourceLink></td>
            </tr>)}</tbody>
          </table>
        </div>}
      {(meta.page > 1 || meta.hasMore) && <nav className="pagination" aria-label="Ranking pages">
        {meta.page > 1 && <Link className="button" href={pageHref(meta.page - 1)}>Previous page</Link>}
        <span>Page {meta.page}</span>
        {meta.hasMore && meta.page < 10_000 && <Link className="button" href={pageHref(meta.page + 1)}>Next page</Link>}
      </nav>}
    </>}
    </div>
  </main>;
}
