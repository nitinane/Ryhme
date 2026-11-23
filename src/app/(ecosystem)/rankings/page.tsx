import { EditorialSearch, PageHeading, PageNotice, PageShell } from "@/components/editorial-page";
import Link from "next/link";
import type { Metadata } from "next";
import { evaluationOriginLabel } from "@/features/benchmarks/categories";
import { categoryName, rankingQuery } from "@/features/benchmarks/query";
import { rankings } from "@/features/benchmarks/service";
import { SourceLink } from "@/features/catalog/components/source-link";
import { date, utcTime } from "@/features/catalog/presentation";
import { homeTokenRates } from "@/features/catalog/services/home";
import { RankingControls, rankingFilters } from "@/features/benchmarks/components/ranking-controls";
import { StudioAnalysis } from "@/app/studio-analysis";
import { catalogCategories } from "@/features/catalog/schemas/query";

export const metadata: Metadata = { title: "Benchmark rankings | Rhyme" };

export default async function RankingsPage({ searchParams }: PageProps<"/rankings">) {
  const raw = await searchParams;
  const input = rankingQuery.safeParse(raw);
  if (!input.success) return <PageNotice title="Benchmark rankings" message="Invalid ranking filters." alert>
    <Link className="button" href="/rankings">Reset filters</Link>
  </PageNotice>;
  const query = { ...input.data, limit: Math.min(input.data.limit, 20) };
  const results = await rankings(query);
  const { benchmark, cohorts, cohort, cohortSource, data, meta } = results;
  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
    params.set("page", String(page));
    return `/rankings?${params}`;
  };
  const rates = await homeTokenRates(data).catch(() => null);
  const methodology = benchmark && cohort ? (
    <details className="studio-method" open>
      <summary>Source &amp; methodology</summary>
      <div><p>{benchmark.methodology}</p>
      <p className="muted mt-2">{evaluationOriginLabel[cohort.evaluationOrigin]}</p>
      <dl className="fact-list" aria-label="Cohort coverage">
        <div><dt>Evaluated models</dt><dd>{cohort.evaluatedModels}</dd></div>
        <div><dt>Distinct families</dt><dd>{cohort.distinctFamilies}</dd></div>
        <div><dt>Distinct labs</dt><dd>{cohort.distinctLabs}</dd></div>
      </dl>
      <p className="muted">Only models with verified scores in this cohort are ranked.</p>
      {cohort.evaluationConfig && <p className="muted">{cohort.evaluationConfig}</p>}
      {cohort.publishedAt && <p className="muted">Archive published {date(cohort.publishedAt)}</p>}
      <p className="muted">Evidence observed {date(cohort.observedAt)}</p>
      {cohortSource?.benchmarkSyncedAt && <p className="muted">Benchmark source synced <time dateTime={cohortSource.benchmarkSyncedAt.toISOString()}>{utcTime(cohortSource.benchmarkSyncedAt)}</time></p>}
      {cohort.datasetRevision && <details className="muted"><summary>Dataset revision</summary><p className="break-all">{cohort.datasetRevision}</p></details>}
      <p className="muted mt-2">{benchmark.metricName} ({benchmark.unit}) · {benchmark.direction === "HIGHER" ? "Higher is better" : "Lower is better"}</p>
      <p className="mt-2"><SourceLink url={benchmark.sourceUrl}>{benchmark.source.name} benchmark source</SourceLink>
        {cohortSource && cohort.sourceId !== benchmark.sourceId && <> / <SourceLink url={cohortSource.homepage}>{cohortSource.name} evaluator</SourceLink></>}</p>
      </div>
    </details>
  ) : null;
  return <PageShell>
    <PageHeading label="AI model research" title="Benchmark" accent="rankings" tools={<EditorialSearch />}>
      <p>Compare model versions in the same published evaluation.</p>
    </PageHeading>
    <div className="analysis-workspace rankings-workspace">
    {query.catalogCategory && <p className="muted text-sm my-3">Catalog scope · {catalogCategories[query.catalogCategory]} · <Link className="text-link" href={`/models?category=${query.catalogCategory}`}>Back to category coverage</Link></p>}
    <RankingControls action="/rankings" options={results} query={query} />
    {!benchmark || !cohort ? <section className="coverage-empty mt-5"><h2>No verified benchmark coverage</h2>
      <p className="muted mt-2">{categoryName(results.category)} has no comparable verified results in this view.</p>
      <Link className="text-link mt-2 inline-block" href="/rankings">Browse available benchmarks</Link> <Link className="text-link ml-3" href="/models">Explore all models</Link>
    </section> : <>
      <div className="studio-cohort">
        <h2 id="benchmark-heading">{benchmark.name}</h2>
        <div><span className="studio-label">Evaluation cohort</span><p>{cohort.evaluationConfig ?? cohort.methodologyVersion ?? benchmark.version ?? "Version unknown"}</p></div>
        <div><span className="studio-label">Evaluation date</span><p>{date(cohort.evaluatedAt)}</p></div>
        <div><span className="studio-label">Coverage</span><p>{cohort.evaluatedModels} models / {cohort.distinctLabs} labs</p></div>
      </div>
      {cohorts.length > 1 && <nav aria-label="Evaluation cohorts" className="mb-3 flex flex-wrap gap-2">{cohorts.map((item) => {
        const params = rankingFilters(query);
        params.set("category", results.category);
        params.set("benchmark", benchmark.slug);
        params.set("cohort", item.id);
        return <Link className="button" key={item.id} aria-current={item.id === cohort.id ? "page" : undefined} href={`/rankings?${params}`}>
          {item.evaluationConfig ?? item.methodologyVersion ?? item.evaluationKey} · {date(item.evaluatedAt ?? item.publishedAt)}
        </Link>;
      })}</nav>}
      {cohort.evaluatedModels < 2 ? <section className="panel"><h2>Insufficient comparable evidence</h2>
        <p className="muted mt-2">This evaluation has fewer than two matched model versions.</p>{methodology}</section> : <>
      <p className="muted mb-3" role="status">{meta.total} scored · {meta.eligible - meta.total} without a comparable score</p>
      {query.catalogCategory && meta.total === 1 ? <section className="panel"><h2>Insufficient comparable evidence</h2>
        <p className="muted mt-2">One matching model has a verified score in this cohort.</p>{methodology}</section> :
      data.length === 0 ? <section className="panel"><h2>No comparable scores on this page</h2>
        <p className="muted mt-2">Try another provider, benchmark, or page.</p>{methodology}</section> :
      <StudioAnalysis key={cohort.id + JSON.stringify(query)} title="Ranked scores" metric={benchmark.metricName} unit={benchmark.unit}
        direction={benchmark.direction} rows={data} rates={rates} filteredCount={meta.total} evaluationDate={date(cohort.evaluatedAt)}>
        {methodology}
      </StudioAnalysis>}
      {(meta.page > 1 || meta.hasMore) && <nav className="pagination" aria-label="Ranking pages">
        {meta.page > 1 && <Link className="button" href={pageHref(meta.page - 1)}>Previous page</Link>}
        <span>Page {meta.page}</span>
        {meta.hasMore && meta.page < 10_000 && <Link className="button" href={pageHref(meta.page + 1)}>Next page</Link>}
      </nav>}
      </>}
    </>}
    </div>
  </PageShell>;
}
