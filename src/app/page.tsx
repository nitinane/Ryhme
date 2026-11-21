import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { homeCatalog } from "@/features/catalog/services/home";
import { date, number } from "@/features/catalog/presentation";
import { lifecycles } from "@/features/catalog/schemas/query";
import { BenchmarkBars } from "@/features/benchmarks/components/benchmark-bars";
import { rankingQuery } from "@/features/benchmarks/query";
import { rankings } from "@/features/benchmarks/service";

export const dynamic = "force-dynamic";

async function CatalogOverview() {
  const catalog = await homeCatalog();

  if (catalog === null) {
    return <p className="panel" role="status">Catalog temporarily unavailable. Reload the page to try again.</p>;
  }
  if (catalog.models === 0) {
    return <p className="panel" role="status">The catalog is empty.</p>;
  }
  return <>
    <section aria-labelledby="catalog-status">
      <h2 id="catalog-status" className="mb-3">Catalog at a glance</h2>
      <dl className="catalog-stats">
        <div className="panel"><dt><Link href="/models">Model versions</Link></dt><dd className="stat-value">{catalog.models}</dd></div>
        <div className="panel"><dt><Link href="/labs">AI labs</Link></dt><dd className="stat-value">{catalog.labs}</dd></div>
        <div className="panel"><dt><Link href="/providers">API providers</Link></dt><dd className="stat-value">{catalog.providers}</dd></div>
        <div className="panel"><dt><Link href="/rankings">Verified benchmarks</Link></dt><dd className="stat-value">{catalog.benchmarks}</dd></div>
      </dl>
    </section>
    {catalog.featured.length > 0 && <section aria-labelledby="featured" className="mt-8">
      <h2 id="featured" className="mb-3">Featured model versions</h2>
      <ul className="directory-grid">{catalog.featured.map((model) => <li className="panel model-card" key={model.id}>
        <p className="muted text-sm">{model.family.lab.name}</p>
        <h3 className="mt-1"><Link className="model-link" href={`/models/${model.slug}`}>{model.canonicalName}</Link></h3>
        <p className="muted text-sm mt-2">Context {number(model.contextTokens)} · {lifecycles[model.lifecycle]}</p>
      </li>)}</ul>
    </section>}
  </>;
}

async function FeaturedBenchmark() {
  const result = await rankings(rankingQuery.parse({ category: "coding", limit: "4" })).catch(() => null);
  if (!result?.benchmark || !result.cohort || !result.data.length) {
    return <section className="panel"><h2>Featured benchmark</h2><p className="muted mt-2">Comparable scores are unavailable.</p></section>;
  }
  const { benchmark, cohort, data, meta } = result;
  return <BenchmarkBars title={benchmark.name} metric={benchmark.metricName} unit={benchmark.unit}
    direction={benchmark.direction} methodology={benchmark.methodology} evidenceDate={date(cohort.evaluatedAt)}
    points={data} missing={meta.eligible - meta.total} />;
}

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="frame home">
      <div className="home-dashboard">
        <section className="home-intro">
          <h1>Find the right AI model</h1>
          <p className="mt-4 max-w-lg leading-relaxed muted">
            Explore model specifications, benchmark results, and provider prices with sources you can inspect.
          </p>
          <Form action="/models" className="home-search">
            <input name="q" type="search" aria-label="Search model catalog" placeholder="Search model catalog" maxLength={120} />
            <button type="submit" className="button primary">Find models</button>
          </Form>
          <nav className="flex flex-wrap gap-4 text-sm" aria-label="Explore Ryhme">
            <Link className="text-link" href="/models">Browse all models</Link>
            <Link className="text-link" href="/rankings">Explore rankings</Link>
            <Link className="text-link" href="/compare">Compare models</Link>
          </nav>
        </section>
        <Suspense fallback={<p className="panel" role="status">Loading benchmark…</p>}>
          <FeaturedBenchmark />
        </Suspense>
      </div>
      <div className="mt-8">
        <Suspense fallback={<p className="panel" role="status">Checking the catalog…</p>}>
          <CatalogOverview />
        </Suspense>
      </div>
    </main>
  );
}
