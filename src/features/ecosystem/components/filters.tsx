import Form from "next/form";
import Link from "next/link";
import { availability } from "@/features/catalog/presentation";
import { capabilities } from "@/features/catalog/schemas/query";
import type { ProviderQuery } from "../query";

export function DirectoryFilters({ action, query, provider, searchLabel, placeholder = searchLabel }: {
  action: string; query: ProviderQuery; provider?: boolean; searchLabel: string; placeholder?: string;
}) {
  return <Form action={action} className="editorial-directory-form" key={JSON.stringify(query)}>
    {query.limit !== 20 && <input type="hidden" name="limit" value={query.limit} />}
    <div className="home-search">
      <input aria-label={searchLabel} placeholder={placeholder} type="search" name="q" maxLength={120} defaultValue={query.q} />
      <button type="submit" className="button primary">Apply filters</button>
    </div>
    {provider && <div className="editorial-directory-options">
      <label>Availability<select name="availability" defaultValue={query.availability ?? ""}>
        <option value="">Any availability</option>
        {Object.entries(availability).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Model capability<select name="capability" defaultValue={query.capability ?? ""}>
        <option value="">Any capability</option>
        {Object.entries(capabilities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>}
    {(query.q || query.availability || query.capability) && <Link className="text-link" href={action}>Clear filters</Link>}
  </Form>;
}

export function DirectoryPages({ path, raw, meta }: {
  path: string;
  raw: Record<string, string | string[] | undefined>;
  meta: { page: number; hasMore: boolean };
}) {
  if (meta.page === 1 && !meta.hasMore) return null;
  function href(page: number) {
    const params = new URLSearchParams(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []));
    params.set("page", String(page));
    return `${path}?${params}`;
  }
  return <nav className="pagination" aria-label="Directory pages">
    {meta.page > 1 && <Link className="button" href={href(meta.page - 1)}>Previous page</Link>}
    <span>Page {meta.page}</span>
    {meta.hasMore && meta.page < 10_000 && <Link className="button" href={href(meta.page + 1)}>Next page</Link>}
  </nav>;
}

export function InvalidDirectoryFilters({ path }: { path: string }) {
  return <p className="panel my-4" role="alert">Invalid filters. <Link className="text-link" href={path}>Reset filters</Link></p>;
}
