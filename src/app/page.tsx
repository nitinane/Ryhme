import { Suspense } from "react";
import Link from "next/link";
import { catalogCount } from "@/features/catalog/services/count";

export const dynamic = "force-dynamic";

async function CatalogStatus() {
  const count = await catalogCount();

  if (count === null) {
    return <p role="status">Catalog temporarily unavailable. Reload the page to try again.</p>;
  }
  if (count === 0) {
    return <p role="status">The catalog is empty.</p>;
  }
  return (
    <p role="status">
      <strong className="mr-1 text-3xl tabular-nums text-cyan-300">{count}</strong>{" "}
      {count === 1 ? "model version" : "model versions"} in the catalog
    </p>
  );
}

export default function Home() {
  return (
    <main id="main-content" className="frame home">
      <h1>Find the right AI model</h1>
      <p className="mt-5 max-w-lg text-lg leading-relaxed muted">
        Explore model specifications, benchmark results, and provider options with sources you can inspect.
      </p>
      <div className="mt-7"><Link className="button primary" href="/models">Browse model catalog</Link></div>
      <section aria-labelledby="catalog-status" className="panel mt-10 min-h-32 max-w-lg">
        <h2 id="catalog-status" className="mb-3 font-medium">Catalog status</h2>
        <Suspense fallback={<p role="status">Checking the catalog…</p>}>
          <CatalogStatus />
        </Suspense>
      </section>
    </main>
  );
}
