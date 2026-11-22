import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { homeCatalog } from "@/features/catalog/services/home";
import { date, number, utcTime } from "@/features/catalog/presentation";
import { SourceLink } from "@/features/catalog/components/source-link";
import { BenchmarkBars } from "@/features/benchmarks/components/benchmark-bars";
import { RankingControls, rankingFilters } from "@/features/benchmarks/components/ranking-controls";
import { evaluationOriginLabel } from "@/features/benchmarks/categories";
import { rankingQuery, type RankingQuery } from "@/features/benchmarks/query";
import { rankings } from "@/features/benchmarks/service";

export const dynamic = "force-dynamic";

async function CatalogOverview({ query }: { query: RankingQuery }) {
  const [catalog, result] = await Promise.all([homeCatalog(), rankings(query, true).catch(() => null)]);
  if (!catalog) return <p className="panel" role="status">Catalog temporarily unavailable. Reload the page to try again.</p>;
  if (!catalog.models) return <p className="panel" role="status">The catalog is empty.</p>;
  const { benchmark, cohort } = result ?? {};
  const params = rankingFilters(query);
  if (result?.category) params.set("category", result.category);
  if (benchmark) params.set("benchmark", benchmark.slug);
  if (cohort) params.set("cohort", cohort.id);

  return <>
    <section className="workspace-summary" aria-labelledby="catalog-status">
      <h2 id="catalog-status" className="sr-only">Catalog at a glance</h2>
      <ul className="analytics-metrics">
        <li><Link href="/models"><strong>{number(catalog.models)}</strong> models</Link></li>
        <li><Link href="/providers"><strong>{number(catalog.providers)}</strong> API providers</Link></li>
        <li><Link href="/labs"><strong>{number(catalog.labs)}</strong> labs &amp; namespaces</Link></li>
        <li><Link href="/rankings"><strong>{number(catalog.benchmarks)}</strong> verified benchmarks</Link></li>
      </ul>
      <p className="muted text-sm">{catalog.source?.homepage && <SourceLink url={catalog.source.homepage}>OpenRouter catalog</SourceLink>}
        {catalog.source?.catalogSyncedAt ? <> / Synced <time dateTime={catalog.source.catalogSyncedAt.toISOString()}>{utcTime(catalog.source.catalogSyncedAt)}</time></>
          : " / Last sync unknown"}</p>
    </section>

    <div className="analytics-stack">
      <section aria-labelledby="home-benchmarks" className="analysis-workspace featured-analysis">
        <header className="workspace-heading">
          <h2 id="home-benchmarks">Benchmark explorer</h2>
          <Link className="text-link text-sm" href={`/rankings?${params}`}>Full leaderboard</Link>
        </header>
        {result && <RankingControls action="/" options={result} query={query} />}
        {result && benchmark && cohort && cohort.evaluatedModels >= 2 ? <>
          <BenchmarkBars key={cohort.id} title={benchmark.name} metric={benchmark.metricName} unit={benchmark.unit}
            direction={benchmark.direction} methodology={benchmark.methodology} evidenceDate={date(cohort.evaluatedAt)}
            points={result.data} compactScores />
          <div className="dashboard-evidence muted text-sm">
            <span>{cohort.evaluatedModels} evaluated / {cohort.distinctLabs} labs / {evaluationOriginLabel[cohort.evaluationOrigin]}</span>
            <SourceLink url={benchmark.sourceUrl}>{benchmark.source.name} methodology</SourceLink>
          </div>
        </> : <p className="coverage-empty muted">Comparable scores are unavailable. <Link className="text-link" href="/models">Explore all models</Link>.</p>}
      </section>
      <section className="catalog-paths" aria-labelledby="explore-catalog">
        <h2 id="explore-catalog">Explore the catalog</h2>
        <div>
          <Link href="/models?sort=price"><span>Token pricing</span><small>Lowest observed USD input rate</small></Link>
          <Link href="/models?capability=tool-calling"><span>Tool calling</span><small>Models with documented tool support</small></Link>
          <Link href="/models?modality=image"><span>Image inputs</span><small>Models that accept images</small></Link>
        </div>
      </section>
      <section className="latest-models" aria-labelledby="featured">
        <header className="workspace-heading"><h2 id="featured">Latest discoveries</h2><Link href="/models?sort=discovered" className="text-link text-sm">See all</Link></header>
        <p className="muted text-xs discovery-caption">Most recent model per lab or namespace</p>
        <ul>{catalog.latest.map((model) => <li key={model.id}>
          <Link className="model-link font-semibold" href={`/models/${model.slug}`}>{model.canonicalName}</Link>
          <p className="muted text-sm">{model.labName}</p>
          <p className="muted text-xs">{model.contextTokens === null ? "Context unknown" : `${number(model.contextTokens)} tokens`} / Added {date(model.createdAt)}</p>
        </li>)}</ul>
      </section>
    </div>
  </>;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const parsed = rankingQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : rankingQuery.parse({});
  return (
    <main id="main-content" tabIndex={-1} className="frame home">
      <header className="home-intro">
        <div><h1>Model benchmarks</h1></div>
        <div className="home-tools">
          <Form action="/models" className="home-search">
            <input name="q" type="search" aria-label="Search model catalog" placeholder="Search model catalog" maxLength={120} />
            <button type="submit" className="button primary">Find models</button>
          </Form>
          <div className="flex gap-4 text-sm"><Link className="text-link" href="/models">Browse all models</Link>
            <Link className="text-link" href="/compare">Compare models</Link></div>
        </div>
      </header>
      <Suspense fallback={<p className="panel" role="status">Checking the catalog…</p>}>
        <CatalogOverview query={query} />
      </Suspense>
    </main>
  );
}
