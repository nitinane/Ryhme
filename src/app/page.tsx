import { Suspense } from "react";
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
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col justify-center px-6 py-16 sm:px-12">
      <p className="mb-6 font-semibold text-cyan-300">OneAtlas</p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">Find the right AI model</h1>
      <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300">
        Explore model specifications, benchmark results, and provider options with sources you can inspect.
      </p>
      <section aria-labelledby="catalog-status" className="mt-10 min-h-32 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h2 id="catalog-status" className="mb-3 font-medium">Catalog status</h2>
        <Suspense fallback={<p role="status">Checking the catalog…</p>}>
          <CatalogStatus />
        </Suspense>
      </section>
    </main>
  );
}
