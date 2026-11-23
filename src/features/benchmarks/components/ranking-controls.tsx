import Form from "next/form";
import Link from "next/link";
import { StudioSelector } from "@/app/studio-selector";
import { FilterPanel } from "@/features/catalog/components/filter-panel";
import { categoryName, type RankingQuery } from "../query";
import type { rankings } from "../service";

type Options = Pick<Awaited<ReturnType<typeof rankings>>, "categories" | "coveredCategories" | "category" | "benchmark" | "benchmarks" | "labs" | "models" | "providers">;

export function rankingFilters(query: RankingQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.catalogCategory) params.set("catalogCategory", query.catalogCategory);
  if (query.provider) params.set("provider", query.provider);
  if (query.lab) params.set("lab", query.lab);
  if (query.model) params.set("model", query.model);
  if (query.sort !== "best") params.set("sort", query.sort);
  if (query.limit !== 20) params.set("limit", String(query.limit));
  return params;
}

export function RankingControls({ action, options, query }: { action: "/" | "/rankings"; options: Options; query: RankingQuery }) {
  const { category, benchmarks, benchmark, labs, models, providers } = options;
  const categories = action === "/" ? options.categories.filter(item => options.coveredCategories.includes(item)) : options.categories;

  return <>
    {categories.length > 0 && <nav className="benchmark-tabs" aria-label="Benchmark categories">
      {categories.map((item) => {
        const params = rankingFilters(query);
        params.set("category", item);
        return <Link key={item} href={`${action}?${params}`}
          aria-current={item === category ? "page" : undefined}>{categoryName(item)}</Link>;
      })}
    </nav>}
    {benchmarks.length > 0 && <Form action={action} className="analytics-filters" key={JSON.stringify(query)}>
      <input type="hidden" name="category" value={category} />
      {query.catalogCategory && <input type="hidden" name="catalogCategory" value={query.catalogCategory} />}
      {query.cohort && <input type="hidden" name="cohort" value={query.cohort} />}
      {query.limit !== 20 && <input type="hidden" name="limit" value={query.limit} />}
      <input type="hidden" name="benchmark" value={benchmark?.slug ?? ""} />
      <StudioSelector label="Benchmark" options={benchmarks.map(option => {
        const params = rankingFilters(query);
        params.set("category", category);
        params.set("benchmark", option.slug);
        return { label: option.name, href: `${action}?${params}`, current: option.slug === benchmark?.slug };
      })} />
      <FilterPanel desktopOpen={action !== "/"} className="ranking-filter-options" label="Filters" active={[query.q, query.lab, query.model, query.provider, query.sort !== "best"].filter(Boolean).length}>
        <div className="ranking-secondary">
          <label>Search rankings<input name="q" type="search" maxLength={120} defaultValue={query.q} placeholder="Model or lab" /></label>
          <label>Lab<select name="lab" defaultValue={query.lab ?? ""}>
            <option value="">All labs</option>
            {labs.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
          </select></label>
          <label>Model<select name="model" defaultValue={query.model ?? ""}>
            <option value="">All models</option>
            {models.map(({ slug, canonicalName }) => <option key={slug} value={slug}>{canonicalName}</option>)}
          </select></label>
          <label>Provider<select name="provider" defaultValue={query.provider ?? ""}>
            <option value="">All providers</option>
            {providers.map(({ slug, name }) => <option key={slug} value={slug}>{name}</option>)}
          </select></label>
          <label>Sort<select name="sort" defaultValue={query.sort}>
            <option value="best">Best score first</option><option value="worst">Worst score first</option>
          </select></label>
        </div>
      </FilterPanel>
      <button className="button" type="submit" aria-label="Apply ranking filters">Apply</button>
    </Form>}
  </>;
}
