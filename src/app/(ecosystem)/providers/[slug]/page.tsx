import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SourceLink } from "@/features/catalog/components/source-link";
import { availability, capabilityNames, date, list } from "@/features/catalog/presentation";
import { slug } from "@/features/catalog/schemas/query";
import { DirectoryFilters, DirectoryPages, InvalidDirectoryFilters } from "@/features/ecosystem/components/filters";
import { providerQuery } from "@/features/ecosystem/query";
import { findProvider } from "@/features/ecosystem/service";
import { getDb } from "@/lib/db/client";

export async function generateMetadata({ params }: PageProps<"/providers/[slug]">): Promise<Metadata> {
  const value = (await params).slug;
  const provider = slug.safeParse(value).success
    ? await getDb().provider.findUnique({ where: { slug: value }, select: { name: true } }) : null;
  return { title: provider ? `${provider.name} provider | Ryhme` : "API provider | Ryhme" };
}

export default async function ProviderPage({ params, searchParams }: PageProps<"/providers/[slug]">) {
  const [{ slug: value }, raw] = await Promise.all([params, searchParams]);
  if (!slug.safeParse(value).success) notFound();
  const path = `/providers/${value}`;
  const input = providerQuery.safeParse(raw);
  if (!input.success) return <main id="main-content" className="frame page"><h1>Provider offerings</h1><InvalidDirectoryFilters path={path} /></main>;
  const provider = await findProvider(value, input.data);
  if (!provider) notFound();
  return <main id="main-content" className="frame page">
    <Link className="text-link" href="/providers">← API providers</Link>
    <div className="page-heading"><h1>{provider.name}</h1><p>Documented API offerings</p>
      {provider.website && <SourceLink url={provider.website}>Official provider website</SourceLink>}
    </div>
    <DirectoryFilters action={path} query={input.data} provider searchLabel="Search offerings" />
    <p className="muted my-4" role="status">{provider.meta.total} {provider.meta.total === 1 ? "offering" : "offerings"}</p>
    {provider.offerings.length ? <ul className="directory-grid">{provider.offerings.map((offer) => {
      const price = offer.prices[0];
      return (
        <li className="panel" key={offer.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2><Link className="text-link" href={`/models/${offer.model.slug}`}>{offer.model.canonicalName}</Link></h2>
            <span className="chip">{availability[offer.availabilityStatus]}</span>
          </div>
          <p className="mt-2">Developed by <Link className="text-link" href={`/labs/${offer.model.family.lab.slug}`}>{offer.model.family.lab.name}</Link></p>
          <p className="muted break-all">{offer.externalModelId}</p>
          <p className="mt-2">Model capabilities · {list(capabilityNames(offer.model.capabilities))}</p>
          <p className="muted mt-1"><SourceLink url={offer.sourceUrl}>Offering source</SourceLink> · Observed {date(offer.observedAt)}</p>
          {price ? <div className="mt-3">
            <p className="font-semibold">Historical pricing · {price.currency} per 1M tokens</p>
            <p>Input {price.inputPerMillion?.toString() ?? "Unknown"} · Output {price.outputPerMillion?.toString() ?? "Unknown"}</p>
            <p className="muted"><SourceLink url={price.sourceUrl}>Price source</SourceLink> · Observed {date(price.observedAt)}</p>
          </div> : <p className="muted mt-2">Pricing unknown.</p>}
        </li>
      );
    })}</ul> : <p className="panel">No offerings match this search or page.</p>}
    <DirectoryPages path={path} raw={raw} meta={provider.meta} />
    {provider.sources.length > 0 && <section className="panel mt-5"><h2>Sources</h2><ul className="detail-list">
      {provider.sources.map((source) => <li key={source.id}><SourceLink url={source.sourceUrl}>Provider identity source</SourceLink> · Observed {date(source.observedAt)}</li>)}
    </ul></section>}
  </main>;
}
