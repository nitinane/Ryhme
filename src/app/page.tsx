import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { homeCatalog, homeTokenRates } from "@/features/catalog/services/home";
import { date, number, utcTime } from "@/features/catalog/presentation";
import { SourceLink } from "@/features/catalog/components/source-link";
import { StudioAnalysis } from "./studio-analysis";
import "./studio.css";
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
  const rates = await homeTokenRates(result?.data.slice(0, 8) ?? []).catch(() => null);
  const params = rankingFilters(query);
  if (result?.category) params.set("category", result.category);
  if (benchmark) params.set("benchmark", benchmark.slug);
  if (cohort) params.set("cohort", cohort.id);

  return <>
    <section className="studio-status" aria-labelledby="catalog-status">
      <h2 id="catalog-status" className="sr-only">Catalog at a glance</h2>
      <ul>
        <li><Link href="/models"><strong>{number(catalog.models)}</strong> models</Link></li>
        <li><Link href="/labs"><strong>{number(catalog.labs)}</strong> labs &amp; namespaces</Link></li>
        <li><Link href="/providers"><strong>{number(catalog.providers)}</strong> API providers</Link></li>
      </ul>
      <p>{catalog.source?.homepage && <SourceLink url={catalog.source.homepage}>OpenRouter catalog</SourceLink>}
        {catalog.source?.catalogSyncedAt ? <> <span aria-hidden="true">/</span> Synced <time dateTime={catalog.source.catalogSyncedAt.toISOString()}>{utcTime(catalog.source.catalogSyncedAt)}</time></> : " / Last sync unknown"}</p>
    </section>

    <section className="studio-workbench" aria-label="Benchmark workbench">
      {result && <div className="studio-controls"><RankingControls action="/" options={result} query={query} /></div>}
      {result && benchmark && cohort && cohort.evaluatedModels >= 2 && result.data.length > 0 ? <>
        <div className="studio-cohort">
          <div><span className="studio-label">Evaluation cohort</span><p>{cohort.methodologyVersion ?? benchmark.version ?? "Version unknown"}</p></div>
          <div><span className="studio-label">Coverage</span><p>{cohort.evaluatedModels} models / {cohort.distinctLabs} labs</p></div>
          <div><span className="studio-label">Evaluated</span><p>{date(cohort.evaluatedAt)}</p></div>
          <Link href={`/rankings?${params}`} className="studio-jump">Full leaderboard <span aria-hidden="true">↗</span></Link>
        </div>
        <StudioAnalysis key={JSON.stringify(query)} title={benchmark.name} metric={benchmark.metricName} unit={benchmark.unit}
          direction={benchmark.direction} rows={result.data.slice(0, 8)} rates={rates} filteredCount={result.meta.total}>
          <details className="studio-method" open>
            <summary>Source &amp; methodology <span>{evaluationOriginLabel[cohort.evaluationOrigin]}</span></summary>
            <div><p>{benchmark.methodology}</p><SourceLink url={benchmark.sourceUrl}>{benchmark.source.name} methodology</SourceLink></div>
          </details>
        </StudioAnalysis>
      </> : <p className="studio-empty">Comparable scores are unavailable for this selection. <Link className="text-link" href="/rankings">Explore benchmark coverage</Link>.</p>}
    </section>
    <div className="studio-discoveries">
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
    <main id="main-content" tabIndex={-1} className="frame studio">
      <header className="studio-intro">
        <div><h1>Intelligence Studio</h1><p>AI model benchmarks and API pricing</p></div>
        <div className="home-tools">
          <Form action="/models" className="home-search">
            <input name="q" type="search" aria-label="Search model catalog" placeholder="Search model catalog" maxLength={120} />
            <button type="submit" className="button primary">Find models</button>
          </Form>
        </div>
      </header>
      <Suspense fallback={<p className="panel" role="status">Checking the catalog…</p>}>
        <CatalogOverview query={query} />
      </Suspense>
    </main>
  );
}
