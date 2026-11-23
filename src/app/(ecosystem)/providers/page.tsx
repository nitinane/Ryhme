import { EditorialWorkspace, PageHeading, PageShell } from "@/components/editorial-page";
import Link from "next/link";
import type { Metadata } from "next";
import { DirectoryFilters, DirectoryPages, InvalidDirectoryFilters } from "@/features/ecosystem/components/filters";
import { providerQuery } from "@/features/ecosystem/query";
import { listProviders } from "@/features/ecosystem/service";

export const metadata: Metadata = { title: "API providers | Rhyme" };

export default async function ProvidersPage({ searchParams }: PageProps<"/providers">) {
  const raw = await searchParams;
  const input = providerQuery.safeParse(raw);
  const result = input.success ? await listProviders(input.data) : null;
  return <PageShell>
    <PageHeading title="API" accent="providers" label="API directory" tools={input.success &&
      <DirectoryFilters action="/providers" query={input.data} provider searchLabel="Search by provider or model name" placeholder="Provider or model" />}>
      <p>Explore services that give you API access to models.</p>
    </PageHeading>
    {input.success && result ? <>
      <EditorialWorkspace title="Providers" aside={<section className="studio-selection">
        <h2>Directory coverage</h2><dl><div><dt>Matching providers</dt>
          <dd role="status">{result.meta.total} {result.meta.total === 1 ? "provider" : "providers"}</dd></div></dl>
      </section>}>
      {result.data.length ? <ul className="editorial-records">{result.data.map((provider) => (
        <li key={provider.id}>
          <h3><Link className="text-link" href={`/providers/${provider.slug}`}>{provider.name}</Link></h3>
          <span className="studio-label">{provider._count.offerings} documented {provider._count.offerings === 1 ? "offering" : "offerings"}</span>
        </li>
      ))}</ul> : <p className="panel">No providers match this search or page.</p>}
      <DirectoryPages path="/providers" raw={raw} meta={result.meta} />
      </EditorialWorkspace>
    </> : <InvalidDirectoryFilters path="/providers" />}
  </PageShell>;
}
