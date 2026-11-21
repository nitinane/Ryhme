import { Suspense } from "react";
import Link from "next/link";
import { homeCatalog } from "@/features/catalog/services/home";
import { number } from "@/features/catalog/presentation";
import { lifecycles } from "@/features/catalog/schemas/query";

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
        <div className="panel"><dt>Model versions</dt><dd className="stat-value">{catalog.models}</dd></div>
        <div className="panel"><dt>AI labs</dt><dd className="stat-value">{catalog.labs}</dd></div>
        <div className="panel"><dt>API providers</dt><dd className="stat-value">{catalog.providers}</dd></div>
        <div className="panel"><dt>Verified benchmarks</dt><dd className="stat-value">{catalog.benchmarks}</dd></div>
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

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1} className="frame home">
      <h1>Find the right AI model</h1>
      <p className="mt-5 max-w-lg text-lg leading-relaxed muted">
        Use Ryhme to explore model specifications, benchmark results, and provider options with sources you can inspect.
      </p>
      <div className="mt-7 flex flex-wrap gap-2">
        <Link className="button primary" href="/models">Browse model catalog</Link>
        <Link className="button" href="/rankings">Explore rankings</Link>
        <Link className="button" href="/compare">Compare models</Link>
      </div>
      <div className="mt-10">
        <Suspense fallback={<p className="panel" role="status">Checking the catalog…</p>}>
          <CatalogOverview />
        </Suspense>
      </div>
    </main>
  );
}
