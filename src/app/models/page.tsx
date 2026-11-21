import Form from "next/form";
import Link from "next/link";
import type { Metadata } from "next";
import { FilterPanel } from "@/features/catalog/components/filter-panel";
import { CompareToggle } from "@/features/comparison/components/selection";
import { catalogOptions, listModels } from "@/features/catalog/services/models";
import { capabilities, catalogQuery, lifecycles } from "@/features/catalog/schemas/query";
import { availability, capabilityNames, date, number } from "@/features/catalog/presentation";

export const metadata: Metadata = { title: "Model catalog | Ryhme" };

const sorts = {
  name: "Name (A–Z)", release: "Newest release", context: "Largest context", price: "Lowest observed USD input price",
};

function Options({ entries }: { entries: { slug: string; name: string }[] }) {
  return entries.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>);
}

export default async function ModelsPage({ searchParams }: PageProps<"/models">) {
  const raw = await searchParams;
  const parsed = catalogQuery.safeParse(raw);
  if (!parsed.success) {
    return <main id="main-content" className="frame page"><h1>Model catalog</h1><p className="panel" role="alert">
      The search parameters are invalid. <Link className="text-link" href="/models">Reset filters</Link>
    </p></main>;
  }
  const query = parsed.data;
  const active = Object.entries(query).filter(([key, value]) =>
    !["page", "limit", "sort"].includes(key) && value !== undefined && value !== "").length;
  const [{ data, meta }, options] = await Promise.all([listModels(query), catalogOptions()]);

  function pageHref(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && value && key !== "page") params.set(key, value);
    }
    params.set("page", String(page));
    return `/models?${params}`;
  }

  return (
    <main id="main-content" className="frame page">
      <div className="page-heading">
        <h1>Model catalog</h1>
        <p>Search documented model versions and narrow by capabilities, context, or provider.</p>
      </div>
      <div className="catalog-layout">
        <FilterPanel active={active}>
          <Form action="/models" className="filters" key={JSON.stringify(query)}>
            <label>Model name<input name="q" type="search" maxLength={120} defaultValue={query.q} placeholder="e.g. GPT-4.1" /></label>
            <label>Family<select name="family" defaultValue={query.family ?? ""}><option value="">All families</option><Options entries={options.families} /></select></label>
            <label>Lab<select name="lab" defaultValue={query.lab ?? ""}><option value="">All labs</option><Options entries={options.labs} /></select></label>
            <label>Provider<select name="provider" defaultValue={query.provider ?? ""}><option value="">All providers</option><Options entries={options.providers} /></select></label>
            <label>Capability<select name="capability" defaultValue={query.capability ?? ""}><option value="">Any capability</option>
              {Object.entries(capabilities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Input modality<select name="modality" defaultValue={query.modality ?? ""}><option value="">Any modality</option>
              {["text", "image", "audio", "video"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select></label>
            <label>Lifecycle<select name="lifecycle" defaultValue={query.lifecycle ?? ""}><option value="">Any lifecycle</option>
              {Object.entries(lifecycles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Open weights<select name="openWeights" defaultValue={query.openWeights?.toString() ?? ""}>
              <option value="">Any</option><option value="true">Open weights</option><option value="false">Closed weights</option>
            </select></label>
            {options.licenses.length > 0 && <label>License<select name="license" defaultValue={query.license ?? ""}>
              <option value="">Any license</option>{options.licenses.map((license) => <option key={license}>{license}</option>)}
            </select></label>}
            <label>Minimum context (tokens)<input name="minContext" inputMode="numeric" pattern="[0-9]{1,10}" defaultValue={query.minContext} /></label>
            <label>Max observed input price (USD / 1M tokens)<input name="maxInputPrice" inputMode="decimal"
              pattern="[0-9]{1,8}(\.[0-9]{1,8})?" defaultValue={query.maxInputPrice} /></label>
            <label>Sort<select name="sort" defaultValue={query.sort}>
              {Object.entries(sorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="button primary">Apply filters</button>
              <Link href="/models" className="text-link text-sm">Clear</Link>
            </div>
            {query.limit !== 20 && <input type="hidden" name="limit" value={query.limit} />}
          </Form>
        </FilterPanel>
        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="results-heading">
            <h2 id="results-heading">Model versions</h2>
            <p role="status" className="muted">{meta.total} {meta.total === 1 ? "result" : "results"}</p>
          </div>
          {data.length === 0 ? (
            <div className="panel">
              <h3>{meta.total ? "No models on this page" : "No matching models"}</h3>
              <p className="muted mt-2">Try a different page or broaden your filters.</p>
              <Link className="text-link mt-3 inline-block" href={meta.total ? pageHref(1) : "/models"}>
                {meta.total ? "Go to first page" : "Clear filters"}
              </Link>
            </div>
          ) : <ul className="catalog-records">{data.map((model) => {
            const offer = model.offerings.find((item) =>
              (!query.provider || item.provider.slug === query.provider) && item.price?.inputPerMillion != null);
            const price = offer?.price;
            return (
              <li className="model-card catalog-record" key={model.id}>
                <div className="catalog-record-heading">
                  <div><p className="muted text-sm">{model.family.lab.name} / {model.family.name}</p>
                    <h3 className="mt-1"><Link className="model-link" href={`/models/${model.slug}`}>{model.name}</Link></h3></div>
                  <span className="chip">{lifecycles[model.lifecycle]}</span>
                </div>
                <dl className="card-specs">
                  <div><dt>Context</dt><dd>{number(model.contextTokens)}{model.contextTokens === null ? "" : " tokens"}</dd></div>
                  <div><dt>Released</dt><dd>{date(model.releaseDate)}</dd></div>
                  <div><dt>Capabilities</dt><dd>{capabilityNames(model.capabilities).join(", ") || "Unknown"}</dd></div>
                  <div><dt>Historical input / 1M tokens</dt>
                    <dd>{offer && price?.inputPerMillion != null ? <>
                      {`${price.currency} ${price.inputPerMillion}`} <span className="muted text-xs">{offer.provider.name}</span>
                    </> : "Unknown"}</dd></div>
                </dl>
                <div className="card-footer">
                  <span className="muted text-sm">{model.offerings.length
                    ? model.offerings.map((offer) => `${offer.provider.name} · ${availability[offer.availabilityStatus]}`).join(" / ")
                    : "Provider offerings unknown"}</span>
                  <CompareToggle id={model.id} name={model.name} />
                </div>
              </li>
            );
          })}</ul>}
          {(meta.page > 1 || meta.hasMore) && <nav className="pagination" aria-label="Catalog pages">
            {meta.page > 1 && <Link className="button" href={pageHref(meta.page - 1)}>Previous page</Link>}
            <span className="muted">Page {meta.page}</span>
            {meta.hasMore && meta.page < 10_000 && <Link className="button" href={pageHref(meta.page + 1)}>Next page</Link>}
          </nav>}
        </section>
      </div>
    </main>
  );
}
