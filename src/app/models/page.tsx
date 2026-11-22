import Form from "next/form";
import Link from "next/link";
import type { Metadata } from "next";
import { SourceLink } from "@/features/catalog/components/source-link";
import { FilterPanel } from "@/features/catalog/components/filter-panel";
import { CompareToggle } from "@/features/comparison/components/selection";
import { catalogOptions, listModels } from "@/features/catalog/services/models";
import { capabilities, catalogQuery, lifecycles } from "@/features/catalog/schemas/query";
import { availability, capabilityNames, number, utcTime } from "@/features/catalog/presentation";

export const metadata: Metadata = { title: "Model catalog | Ryhme" };

const sorts = {
  discovered: "Recently discovered",
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

  const syncedAt = options.catalogSyncedAt;

  function catalogHref(change: { page: number } | { sort: keyof typeof sorts }) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && value && key !== "page") params.set(key, value);
    }
    for (const [key, value] of Object.entries(change)) params.set(key, String(value));
    return `/models?${params}`;
  }

  return (
    <main id="main-content" className="frame page">
      <div className="page-heading">
        <h1>All models</h1>

        <p className="text-sm">Last successful OpenRouter sync {syncedAt
          ? <><time dateTime={syncedAt.toISOString()}>{utcTime(syncedAt)}</time>{options.syncOverdue && " · Sync overdue"}</>
          : "· Awaiting first scheduled run"}</p>
      </div>
      <div className="catalog-workspace">
        <Form action="/models" className="catalog-controls" key={JSON.stringify(query)}>
          <div className="catalog-search">
            <label>Model name<input name="q" type="search" maxLength={120} defaultValue={query.q} placeholder="Search models" /></label>
            <button type="submit" className="button primary">Search</button>
          </div>
          <FilterPanel active={active} label="Catalog filters" desktopOpen={false}>
            <div className="filters">
            <label>Family<select name="family" defaultValue={query.family ?? ""}><option value="">All families</option><Options entries={options.families} /></select></label>
            <label>Lab<select name="lab" defaultValue={query.lab ?? ""}><option value="">All labs</option><Options entries={options.labs} /></select></label>
            <label>Provider<select name="provider" defaultValue={query.provider ?? ""}><option value="">All providers</option><Options entries={options.providers} /></select></label>
            <label>Capability<select name="capability" defaultValue={query.capability ?? ""}><option value="">Any capability</option>
              {Object.entries(capabilities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Input modality<select name="modality" defaultValue={query.modality ?? ""}><option value="">Any modality</option>
              {["text", "image", "audio", "video"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select></label>
            <label>Availability<select name="availability" defaultValue={query.availability ?? ""}>
              <option value="">Any offering status</option>
              {Object.entries(availability).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
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
            </div>
          </FilterPanel>
        </Form>
        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="results-heading">
            <h2 id="results-heading">{meta.total ? `${number(meta.total)} model versions` : "Model versions"}</h2>
            <p role="status" className="muted">{meta.total} {meta.total === 1 ? "result" : "results"}</p>
          </div>
          {data.length === 0 ? (
            <div className="panel">
              <h3>{meta.total ? "No models on this page" : "No matching models"}</h3>
              <p className="muted mt-2">Try a different page or broaden your filters.</p>
              <Link className="text-link mt-3 inline-block" href={meta.total ? catalogHref({ page: 1 }) : "/models"}>
                {meta.total ? "Go to first page" : "Clear filters"}
              </Link>
            </div>
          ) : <>
            <p className="catalog-scroll-hint catalog-note muted mb-2">Scroll the table for pricing, capabilities, and availability.</p>
            <div className="catalog-table-scroll" role="region" aria-label="Model catalog table" aria-describedby="catalog-price-note" tabIndex={0}>
              <table className="catalog-table">
                <thead><tr>
                  <th scope="col" aria-sort={query.sort === "name" ? "ascending" : undefined}>
                    <Link href={catalogHref({ sort: "name" })}>Model / lab <span aria-hidden="true">{query.sort === "name" ? "↑" : "↕"}</span></Link>
                  </th>
                  <th scope="col">Family</th>
                  <th scope="col" aria-sort={query.sort === "context" ? "descending" : undefined}>
                    <Link href={catalogHref({ sort: "context" })}>Context <span aria-hidden="true">{query.sort === "context" ? "↓" : "↕"}</span></Link>
                  </th>
                  <th scope="col" aria-sort={query.sort === "price" ? "ascending" : undefined}>
                    <Link href={catalogHref({ sort: "price" })}>Input / 1M <span aria-hidden="true">{query.sort === "price" ? "↑" : "↕"}</span></Link>
                  </th>
                  <th scope="col">Output / 1M</th>
                  <th scope="col">Capabilities</th>
                  <th scope="col">Availability</th>
                  <th scope="col">Compare</th>
                </tr></thead>
                <tbody>{data.map((model) => {
                  const offerings = model.offerings.filter(item =>
                    (!query.provider || item.provider.slug === query.provider) && (!query.availability || item.availabilityStatus === query.availability));
                  const priceOffering = offerings.find(({ price }) => price?.inputPerMillion != null)
                    ?? offerings.find(({ price }) => price?.outputPerMillion != null);
                  const price = priceOffering?.price;
                  const attributed = priceOffering ?? offerings[0];
                  const statuses = [...new Set(offerings.map(offer =>
                    availability[offer.availabilityStatus] + (offer.catalogMissingSince && offer.availabilityStatus === "LISTED" ? " (not seen recently)" : "")))];
                  return <tr key={model.id}>
                    <th scope="row">
                      <Link className="model-link" href={`/models/${model.slug}`}>{model.name}</Link>
                      <span className="catalog-lab">{model.family.lab.name}{model.recentlyAdded && <small>New to Ryhme</small>}</span>
                    </th>
                    <td>{model.family.name}</td>
                    <td className="catalog-number">{model.contextTokens == null ? "—" : number(model.contextTokens)}</td>
                    <td className="catalog-number">{price?.inputPerMillion == null ? "—" : `${price.currency} ${price.inputPerMillion}`}</td>
                    <td className="catalog-number">{price?.outputPerMillion == null ? "—" : `${price.currency} ${price.outputPerMillion}`}</td>
                    <td>{capabilityNames(model.capabilities).join(", ") || "—"}</td>
                    <td>
                      {statuses.join(" / ") || "Unknown"}
                      {attributed && <details className="catalog-source">
                        <summary>Evidence</summary>
                        <span>{attributed.provider.name} · {lifecycles[model.lifecycle]} · Updated <time dateTime={model.updatedAt.toISOString()}>{utcTime(model.updatedAt)}</time></span>
                        <SourceLink url={attributed.sourceUrl}>{attributed.source.name} offering source</SourceLink>
                      </details>}
                    </td>
                    <td><CompareToggle id={model.id} name={model.name} /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </>}
          {data.length > 0 && <p id="catalog-price-note" className="catalog-note muted">Historical token rates from a single offering per row. — means undocumented.</p>}
          {(meta.page > 1 || meta.hasMore) && <nav className="pagination" aria-label="Catalog pages">
            {meta.page > 1 && <Link className="button" href={catalogHref({ page: meta.page - 1 })}>Previous page</Link>}
            <span className="muted">Page {meta.page} of {Math.ceil(meta.total / meta.limit)}</span>
            {meta.hasMore && meta.page < 10_000 && <Link className="button" href={catalogHref({ page: meta.page + 1 })}>Next page</Link>}
          </nav>}
        </section>
      </div>
    </main>
  );
}
