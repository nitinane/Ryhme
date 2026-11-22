import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { homeCatalog, homeTokenRates } from "@/features/catalog/services/home";
import { date, number, utcTime } from "@/features/catalog/presentation";
import { SourceLink } from "@/features/catalog/components/source-link";
import { StudioAnalysis } from "./studio-analysis";
import { StudioSelector } from "./studio-selector";
import "./studio.css";
import { rankingFilters } from "@/features/benchmarks/components/ranking-controls";
import { evaluationOriginLabel } from "@/features/benchmarks/categories";
import { categoryName, rankingQuery, type RankingQuery } from "@/features/benchmarks/query";
import { rankings } from "@/features/benchmarks/service";

export const dynamic = "force-dynamic";

const leaderboardLimit = 20;

async function CatalogOverview({ query }: { query: RankingQuery }) {
  const [catalog, result] = await Promise.all([homeCatalog(), rankings(query, true).catch(() => null)]);
  const { benchmark, cohort, cohortSource } = result ?? {};
  const rates = await homeTokenRates(result?.data.slice(0, leaderboardLimit) ?? []).catch(() => null);
  const params = rankingFilters(query);
  if (result?.category) params.set("category", result.category);
  if (benchmark) params.set("benchmark", benchmark.slug);
  if (cohort) params.set("cohort", cohort.id);
  const benchmarkParams = rankingFilters(query);
  if (result?.category) benchmarkParams.set("category", result.category);
  const benchmarkOptions = result?.benchmarks.map(option => {
    const next = new URLSearchParams(benchmarkParams);
    next.set("benchmark", option.slug);
    return { label: option.name, href: `/?${next}`, current: option.slug === benchmark?.slug };
  }) ?? [];
  const cohortOptions = result?.cohorts.map(option => {
    const next = new URLSearchParams(params);
    next.set("cohort", option.id);
    return { label: `${date(option.evaluatedAt)} · ${option.evaluatedModels} models · ${option.methodologyVersion ?? evaluationOriginLabel[option.evaluationOrigin]}`,
      href: `/?${next}`, current: option.id === cohort?.id };
  }) ?? [];

  return <>
    {catalog && <section className="studio-status" aria-labelledby="catalog-status">
      <h2 id="catalog-status" className="sr-only">Catalog at a glance</h2>
      <ul>
        <li><Link href="/models"><strong>{number(catalog.models)}</strong> models</Link></li>
        <li><Link href="/labs"><strong>{number(catalog.labs)}</strong> labs &amp; namespaces</Link></li>
        <li><Link href="/providers"><strong>{number(catalog.providers)}</strong> API providers</Link></li>
      </ul>
      <p>{catalog.source?.homepage && <SourceLink url={catalog.source.homepage}>OpenRouter catalog</SourceLink>}
        {catalog.source?.catalogSyncedAt ? <> <span aria-hidden="true">/</span> Catalog synced <time dateTime={catalog.source.catalogSyncedAt.toISOString()}>{utcTime(catalog.source.catalogSyncedAt)}</time></> : " / Last sync unknown"}</p>
    </section>}

    <section className="studio-workbench" aria-label="Benchmark workbench">
      {result && <div className="studio-controls">
        <nav className="benchmark-tabs" aria-label="Benchmark categories">
          {result.categories.filter(item => result.coveredCategories.includes(item)).map(item => {
            const next = rankingFilters(query);
            next.set("category", item);
            return <Link key={item} href={`/?${next}`} scroll={false} aria-current={item === result.category ? "page" : undefined}>{categoryName(item)}</Link>;
          })}
        </nav>
        <div className="studio-filters">
          {benchmarkOptions.length > 0 && <StudioSelector label="Benchmark" options={benchmarkOptions} />}
          {cohortOptions.length > 1 && <StudioSelector label="Cohort" options={cohortOptions} />}
        </div>
      </div>}
      {result && benchmark && cohort && cohort.evaluatedModels >= 2 && result.data.length > 0 ? <>
        <div className="studio-cohort">
          <div><span className="studio-label">Evaluation cohort</span><p>{cohort.methodologyVersion ?? benchmark.version ?? "Version unknown"}</p></div>
          <div><span className="studio-label">Coverage</span><p>{cohort.evaluatedModels} models / {cohort.distinctLabs} labs</p></div>
          <div><span className="studio-label">Evaluation date</span><p>{cohort.evaluatedAt ? <time dateTime={cohort.evaluatedAt.toISOString().slice(0, 10)}>{date(cohort.evaluatedAt)}</time> : date(null)}</p></div>
          <Link href={`/rankings?${params}`} className="studio-jump">Full leaderboard <span aria-hidden="true">↗</span></Link>
        </div>
        <StudioAnalysis key={cohort.id + JSON.stringify(query)} title={benchmark.name} metric={benchmark.metricName} unit={benchmark.unit}
          direction={benchmark.direction} rows={result.data.slice(0, leaderboardLimit)} rates={rates} filteredCount={result.meta.total}>
          <details className="studio-method" open>
            <summary>Source &amp; methodology <span>{evaluationOriginLabel[cohort.evaluationOrigin]}</span></summary>
            <div><p>{benchmark.methodology}</p><p>Evidence observed {date(cohort.observedAt)}</p>
              <SourceLink url={benchmark.sourceUrl}>{benchmark.source.name} methodology</SourceLink>
              {cohortSource?.homepage && cohortSource.name !== benchmark.source.name && <SourceLink url={cohortSource.homepage}>{cohortSource.name} evaluation source</SourceLink>}
            </div>
          </details>
        </StudioAnalysis>
      </> : <p className="studio-empty" role="status">{result ? "Comparable scores are unavailable for this selection." : "Benchmark data is temporarily unavailable."} <Link className="text-link" href="/rankings">Explore benchmark coverage</Link>.</p>}
    </section>
  </>;
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const parsed = rankingQuery.safeParse(await searchParams);
  const query = { ...(parsed.success ? parsed.data : rankingQuery.parse({})), page: 1, limit: leaderboardLimit, sort: "best" as const };
  return (
    <main id="main-content" tabIndex={-1} className="frame studio">
      <header className="studio-intro">
        <div className="studio-editorial"><p className="studio-label">AI model research</p><h1>Model performance, <em>in context.</em></h1>
          <p>Compare AI models using published benchmarks and API prices.</p></div>
        <div className="home-tools">
          <Form action="/models" className="home-search">
            <input name="q" type="search" aria-label="Search model catalog" placeholder="Search model catalog" maxLength={120} />
            <button type="submit" className="button primary">Find models</button>
          </Form>
        </div>
      </header>
      <Suspense fallback={<p className="studio-loading" role="status">Loading benchmark data…</p>}>
        <CatalogOverview query={query} />
      </Suspense>
    </main>
  );
}
