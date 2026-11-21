import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { homeCatalog } from "@/features/catalog/services/home";
import { date, number } from "@/features/catalog/presentation";
import { lifecycles } from "@/features/catalog/schemas/query";
import { SourceLink } from "@/features/catalog/components/source-link";
import { BenchmarkBars } from "@/features/benchmarks/components/benchmark-bars";
import { RankingControls, rankingFilters } from "@/features/benchmarks/components/ranking-controls";
import { scoreLabel } from "@/features/benchmarks/chart-data";
import { rankingQuery, type RankingQuery } from "@/features/benchmarks/query";
import { rankings } from "@/features/benchmarks/service";

export const dynamic = "force-dynamic";

async function CatalogOverview({ query }: { query: RankingQuery }) {
  const [catalog, result] = await Promise.all([homeCatalog(), rankings(query).catch(() => null)]);
  if (!catalog) return <p className="panel" role="status">Catalog temporarily unavailable. Reload the page to try again.</p>;
  if (!catalog.models) return <p className="panel" role="status">The catalog is empty.</p>;

  const best = result?.data.reduce<NonNullable<typeof result>["data"][number] | undefined>(
    (leader, point) => !leader || point.rank < leader.rank ? point : leader, undefined);
  const { benchmark, cohort } = result ?? {};
  const price = catalog.price;
  const leaderboardParams = rankingFilters(query);
  if (result?.category) leaderboardParams.set("category", result.category);
  if (benchmark) leaderboardParams.set("benchmark", benchmark.slug);

  return <>
    <section aria-labelledby="performance-overview">
      <h2 id="performance-overview" className="sr-only">Performance overview</h2>
      <dl className="overview-metrics">
        <div><dt><span className="metric-mark intelligence-mark" />Intelligence</dt>
          <dd className="metric-value">{best && benchmark ? scoreLabel(best.score, benchmark.unit) : "Unavailable"}</dd>
          <dd className="muted text-sm">{best && benchmark ? `${best.name} · ${benchmark.name}` : "No verified scores for this view"}</dd></div>
        <div><dt><span className="metric-mark speed-mark" />Speed</dt>
          <dd className="metric-status">Unavailable</dd>
          <dd className="muted text-sm">No verified measurements</dd></div>
        <div><dt><span className="metric-mark cost-mark" />Cost</dt>
          <dd className="metric-value">{price ? `${price.currency} ${price.inputPerMillion}` : "Unavailable"}</dd>
          <dd className="muted text-sm">{price ? <>Per 1M input tokens. <SourceLink url={price.sourceUrl}>Historical price</SourceLink> for {price.offering.model.canonicalName}.</> : "No verified pricing observation"}</dd></div>
      </dl>
    </section>

    <section aria-labelledby="home-benchmarks" className="analysis-workspace mt-5">
      <header className="workspace-heading">
        <div><h2 id="home-benchmarks">Model performance</h2><p className="muted text-sm">Compare scores within a published evaluation.</p></div>
        <Link className="text-link text-sm" href={`/rankings?${leaderboardParams}`}>Full leaderboard</Link>
      </header>
      {result && <RankingControls action="/" options={result} query={query} />}
      {result && benchmark && cohort ? <div className="ranking-insights">
        <BenchmarkBars key={cohort.id} title={benchmark.name} metric={benchmark.metricName} unit={benchmark.unit}
          direction={benchmark.direction} methodology={benchmark.methodology} evidenceDate={date(cohort.evaluatedAt)}
          points={result.data} missing={result.meta.eligible - result.meta.total} />
        <aside className="evidence-panel" aria-label="Benchmark methodology">
          <h3>Methodology</h3>
          <p>{benchmark.methodology}</p>
          <p className="muted">Evaluation date {date(cohort.evaluatedAt)}<br />{cohort.methodologyVersion ?? benchmark.version ?? "Methodology version unknown"}</p>
          <SourceLink url={benchmark.sourceUrl}>{benchmark.source.name} benchmark source</SourceLink>
        </aside>
      </div> : <p className="panel muted">Comparable scores are unavailable.</p>}
    </section>

    <section aria-labelledby="catalog-status" className="mt-6">
      <h2 id="catalog-status" className="mb-2">Catalog at a glance</h2>
      <dl className="catalog-stats">
        <div className="panel"><dt><Link href="/models">Model versions</Link></dt><dd className="stat-value">{catalog.models}</dd></div>
        <div className="panel"><dt><Link href="/labs">AI labs</Link></dt><dd className="stat-value">{catalog.labs}</dd></div>
        <div className="panel"><dt><Link href="/providers">API providers</Link></dt><dd className="stat-value">{catalog.providers}</dd></div>
        <div className="panel"><dt><Link href="/rankings">Verified benchmarks</Link></dt><dd className="stat-value">{catalog.benchmarks}</dd></div>
      </dl>
    </section>
    {catalog.featured.length > 0 && <section aria-labelledby="featured" className="mt-5">
      <h2 id="featured" className="mb-2">Featured model versions</h2>
      <ul className="featured-list">{catalog.featured.map((model) => <li key={model.id}>
        <Link className="text-link font-semibold" href={`/models/${model.slug}`}>{model.canonicalName}</Link>
        <span className="muted text-sm">{model.family.lab.name} · {number(model.contextTokens)} context tokens · {lifecycles[model.lifecycle]}</span>
      </li>)}</ul>
    </section>}
  </>;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const parsed = rankingQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : rankingQuery.parse({});
  return (
    <main id="main-content" tabIndex={-1} className="frame home">
      <header className="home-intro">
        <div>
          <h1>Find the right AI model</h1>
          <p className="muted">Explore model specifications, benchmark results, and provider prices with sources you can inspect.</p>
        </div>
        <div className="home-tools">
          <Form action="/models" className="home-search">
            <input name="q" type="search" aria-label="Search model catalog" placeholder="Search model catalog" maxLength={120} />
            <button type="submit" className="button primary">Find models</button>
          </Form>
          <Link className="text-link text-sm" href="/compare">Compare models</Link>
        </div>
      </header>
      <Suspense fallback={<p className="panel" role="status">Checking the catalog…</p>}>
        <CatalogOverview query={query} />
      </Suspense>
    </main>
  );
}
