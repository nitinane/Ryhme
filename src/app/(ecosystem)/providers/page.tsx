import Link from "next/link";
import type { Metadata } from "next";
import { DirectoryFilters, DirectoryPages, InvalidDirectoryFilters } from "@/features/ecosystem/components/filters";
import { providerQuery } from "@/features/ecosystem/query";
import { listProviders } from "@/features/ecosystem/service";

export const metadata: Metadata = { title: "API providers | OneAtlas" };

export default async function ProvidersPage({ searchParams }: PageProps<"/providers">) {
  const raw = await searchParams;
  const input = providerQuery.safeParse(raw);
  const result = input.success ? await listProviders(input.data) : null;
  return <main id="main-content" className="frame page">
    <div className="page-heading"><h1>API providers</h1><p>Explore services that give you API access to models.</p></div>
    {input.success && result ? <>
      <DirectoryFilters action="/providers" query={input.data} provider searchLabel="Search by provider or model name" />
      <p className="muted my-4" role="status">{result.meta.total} {result.meta.total === 1 ? "provider" : "providers"}</p>
      {result.data.length ? <ul className="directory-grid">{result.data.map((provider) => (
        <li key={provider.id} className="panel model-card">
          <h2><Link className="model-link" href={`/providers/${provider.slug}`}>{provider.name}</Link></h2>
          <p className="muted mt-2">{provider._count.offerings} documented {provider._count.offerings === 1 ? "offering" : "offerings"}</p>
        </li>
      ))}</ul> : <p className="panel">No providers match this search or page.</p>}
      <DirectoryPages path="/providers" raw={raw} meta={result.meta} />
    </> : <InvalidDirectoryFilters path="/providers" />}
  </main>;
}
