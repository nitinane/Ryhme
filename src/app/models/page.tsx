import { EditorialSearch, PageHeading, PageNotice, PageShell } from "@/components/editorial-page";
import Form from "next/form";
import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { databaseConnectionString } from "@/lib/config/database";
import { SourceLink } from "@/features/catalog/components/source-link";
import { FilterPanel } from "@/features/catalog/components/filter-panel";
import { CategoryCoverage } from "@/features/catalog/components/category-coverage";
import { CompareToggle } from "@/features/comparison/components/selection";
import { catalogOptions, listModels } from "@/features/catalog/services/models";
import { capabilities, catalogCategories, catalogQuery, evidenceStatuses, lifecycles, pricingStatuses, type CatalogQuery } from "@/features/catalog/schemas/query";
import { availability, capabilityNames, number, utcTime } from "@/features/catalog/presentation";

export const metadata: Metadata = { title: "Model catalog | Rhyme" };

const cacheKey = ["catalog-page", process.env.VERCEL_DEPLOYMENT_ID ?? "local"];
const catalogRevalidation = { revalidate: 300 };
const cachedOptions = unstable_cache(catalogOptions, [...cacheKey, "options"], catalogRevalidation);
const cachedModels = unstable_cache((query: CatalogQuery) => listModels(query, Boolean(query.category)),
  [...cacheKey, "results"], catalogRevalidation);

function CatalogTime({ value }: { value: Date | string }) {
  const timestamp = new Date(value);
  return <time dateTime={timestamp.toISOString()}>{utcTime(timestamp)}</time>;
}

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
    return <PageNotice title="Model catalog" message="The search parameters are invalid." alert>
      <Link className="button" href="/models">Reset filters</Link>
    </PageNotice>;
  }
  const query = parsed.data;
  databaseConnectionString();
  const [{ data, meta, breakdown }, options] = await Promise.all([
    cachedModels(query),
    cachedOptions(),
  ]);
  const { coverage } = options;
  const selectedCoverage = coverage.categories.find(({ category }) => category === query.category) ?? coverage;
  const filterLabels = {
    q: "Search", family: "Family", lab: "Publisher", provider: "Provider", capability: "Capability", modality: "Input",
    availability: "Availability", lifecycle: "Lifecycle", openWeights: "Weights", license: "License",
    minContext: "Minimum context", maxInputPrice: "Maximum USD input rate", evidence: "Evidence", pricing: "Pricing",
  };
  const filterValues = {
    family: options.families.find(({ slug }) => slug === query.family)?.name,
    lab: options.labs.find(({ slug }) => slug === query.lab)?.name,
    provider: options.providers.find(({ slug }) => slug === query.provider)?.name,
    capability: query.capability && capabilities[query.capability],
    availability: query.availability && availability[query.availability],
    lifecycle: query.lifecycle && lifecycles[query.lifecycle],
    openWeights: query.openWeights === undefined ? undefined : query.openWeights ? "Open" : "Closed",
    evidence: query.evidence && evidenceStatuses[query.evidence],
    pricing: query.pricing && pricingStatuses[query.pricing],
  };
  const active = (Object.keys(filterLabels) as (keyof typeof filterLabels)[])
    .filter(key => query[key] !== undefined && query[key] !== "");

  const syncedAt = options.catalogSyncedAt;

  function catalogHref(change: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && value && key !== "page") params.set(key, value);
    }
    for (const [key, value] of Object.entries(change)) {
      if (value === undefined) params.delete(key);
      else params.set(key, String(value));
    }
    return params.size ? `/models?${params}` : "/models";
  }

  return (
    <PageShell>
      <PageHeading label="Model catalog" title="All" accent="models" tools={
        <EditorialSearch key={JSON.stringify(query)} label="Model name or family" button="Search" query={query.q}>
          {Object.entries(raw).map(([key, value]) => typeof value === "string" && !["q", "page"].includes(key)
            ? <input key={key} type="hidden" name={key} value={value} /> : null)}
        </EditorialSearch>
      }>
        <p className="text-sm">Last successful OpenRouter sync {syncedAt
          ? <><CatalogTime value={syncedAt} />{options.syncOverdue && " · Sync overdue"}</>
          : "· Awaiting first scheduled run"}</p>
      </PageHeading>
      <div className="catalog-workspace">
        <nav className="benchmark-tabs" aria-label="Model categories">
          <Link href={catalogHref({ category: undefined })} aria-current={!query.category ? "page" : undefined}>All models <span className="catalog-number">{number(coverage.total)}</span></Link>
          {coverage.categories.filter(({ category, total }) => total > 0 || category === query.category).map(({ category, total }) =>
            <Link key={category} href={catalogHref({ category })} aria-current={category === query.category ? "page" : undefined}>
              {catalogCategories[category]} <span className="catalog-number">{number(total)}</span>
            </Link>)}
        </nav>
        <p className="muted text-sm my-3">
          {number(selectedCoverage.total)} cataloged · {number(selectedCoverage.evaluated)} evaluated before filters.
          Categories can overlap. <Link className="text-link" href="/rankings">Rankings by benchmark cohort</Link>
        </p>
        {(query.category || active.length > 0) && <ul className="flex flex-wrap items-center gap-2 my-3" aria-label="Active catalog filters">
          {query.category && <li><Link className="button catalog-filter-chip" href={catalogHref({ category: undefined })} aria-label={`Remove category: ${catalogCategories[query.category]}`}>
            {catalogCategories[query.category]} <span aria-hidden="true">×</span>
          </Link></li>}
          {active.map(key => {
            const label = `${filterLabels[key]}: ${Object.hasOwn(filterValues, key) ? filterValues[key as keyof typeof filterValues] ?? query[key] : query[key]}`;
            return <li key={key} className="min-w-0"><Link className="button catalog-filter-chip" href={catalogHref({ [key]: undefined })} aria-label={`Remove ${label}`}>
              {label} <span aria-hidden="true">×</span>
            </Link></li>;
          })}
          <li><Link className="text-link" href="/models">Clear all</Link></li>
        </ul>}
        <Form action="/models" className="catalog-controls" key={JSON.stringify(query)}>
          <input type="hidden" name="q" value={query.q ?? ""} />
          {query.category && <input type="hidden" name="category" value={query.category} />}
          <FilterPanel active={active.length} label="Catalog filters" desktopOpen={false}>
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
            <label>Benchmark evidence<select name="evidence" defaultValue={query.evidence ?? ""}>
              <option value="">Any evidence status</option>
              {Object.entries(evidenceStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <label>Pricing availability<select name="pricing" defaultValue={query.pricing ?? ""}>
              <option value="">Any pricing status</option>
              {Object.entries(pricingStatuses).map(([value, label]) => <option key={value} value={value}>{label} (listed offerings)</option>)}
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
              <Link href="/models" className="text-link text-sm">Clear all</Link>
            </div>
            {query.limit !== 20 && <input type="hidden" name="limit" value={query.limit} />}
            </div>
          </FilterPanel>
        </Form>
        {query.category && breakdown && <CategoryCoverage category={query.category} total={meta.total} breakdown={breakdown} />}
        <section aria-labelledby="results-heading" className="studio-board">
          <div className="studio-section-head results-heading">
            <h2 id="results-heading">{meta.total ? `${number(meta.total)} model versions` : "Model versions"}</h2>
            <p role="status" className="studio-label">{meta.total} {meta.total === 1 ? "result" : "results"}</p>
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
                      <span className="catalog-lab">{model.family.lab.name}</span>
                    </th>
                    <td>{model.family.name}<p className="catalog-evidence-state">{model.verifiedResults ? "Evaluated · Verified evidence" : "No verified benchmark evidence"}</p></td>
                    <td className="catalog-number">{model.contextTokens == null ? "—" : number(model.contextTokens)}</td>
                    <td className="catalog-number">{price?.inputPerMillion == null ? "—" : `${price.currency} ${price.inputPerMillion}`}</td>
                    <td className="catalog-number">{price?.outputPerMillion == null ? "—" : `${price.currency} ${price.outputPerMillion}`}</td>
                    <td>{capabilityNames(model.capabilities).join(", ") || "—"}</td>
                    <td>
                      {statuses.join(" / ") || "Unknown"}
                      {attributed && <details className="catalog-source">
                        <summary>Evidence</summary>
                        <span>{attributed.provider.name} · {lifecycles[model.lifecycle]} · Updated <CatalogTime value={model.updatedAt} /></span>
                        <SourceLink url={attributed.sourceUrl}>{attributed.source.name} offering source</SourceLink>
                        {price && <span><SourceLink url={price.sourceUrl}>Price source</SourceLink> · Observed <CatalogTime value={price.observedAt} /></span>}
                      </details>}
                    </td>
                    <td><CompareToggle id={model.id} name={model.name} /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </>}
          {data.length > 0 && <p id="catalog-price-note" className="catalog-note muted">Historical token rates from one offering per row. A dash means undocumented. Ranking eligibility is determined separately for each benchmark cohort.</p>}
          {(meta.page > 1 || meta.hasMore) && <nav className="pagination" aria-label="Catalog pages">
            {meta.page > 1 && <Link className="button" href={catalogHref({ page: meta.page - 1 })}>Previous page</Link>}
            <span className="muted">Page {meta.page} of {Math.ceil(meta.total / meta.limit)}</span>
            {meta.hasMore && meta.page < 10_000 && <Link className="button" href={catalogHref({ page: meta.page + 1 })}>Next page</Link>}
          </nav>}
        </section>
      </div>
    </PageShell>
  );
}
