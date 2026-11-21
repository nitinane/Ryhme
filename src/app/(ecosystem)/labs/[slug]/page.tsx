import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { SourceLink } from "@/features/catalog/components/source-link";
import { capabilityNames, date, list } from "@/features/catalog/presentation";
import { lifecycles, slug } from "@/features/catalog/schemas/query";
import { findLab } from "@/features/ecosystem/service";

export const dynamic = "force-dynamic";
const getLab = cache((value: string) => slug.safeParse(value).success ? findLab(value) : null);

export async function generateMetadata({ params }: PageProps<"/labs/[slug]">): Promise<Metadata> {
  const lab = await getLab((await params).slug);
  return { title: lab ? `${lab.name} lab | OneAtlas` : "AI lab | OneAtlas" };
}

export default async function LabPage({ params }: PageProps<"/labs/[slug]">) {
  const lab = await getLab((await params).slug);
  if (!lab) notFound();
  return <main id="main-content" className="frame page">
    <Link className="text-link" href="/labs">← AI labs</Link>
    <div className="page-heading"><h1>{lab.name}</h1><p>{lab.description ?? "Model developer and publisher"}</p>
      {lab.website && <SourceLink url={lab.website}>Official lab website</SourceLink>}
    </div>
    <section aria-labelledby="families"><h2 id="families" className="mb-3">Model families</h2>
      {lab.families.length ? <ul className="directory-grid">{lab.families.map((family) => (
        <li key={family.id} className="panel">
          <h3>{family.name}</h3>
          {family.description && <p className="muted mt-2">{family.description}</p>}
          {family.versions.length ? <ul className="detail-list">{family.versions.map((model) => (
            <li key={model.id}>
              <Link className="text-link" href={`/models/${model.slug}`}>{model.canonicalName}</Link>
              <p className="muted text-sm">{lifecycles[model.lifecycle]} · {list(capabilityNames(model.capabilities))}</p>
              {model.offerings.length > 0 && <div className="flex flex-wrap gap-2 text-sm">{model.offerings.map(({ provider }) => (
                <Link key={provider.slug} className="text-link" href={`/providers/${provider.slug}`}>{provider.name}</Link>
              ))}</div>}
            </li>
          ))}</ul> : <p className="muted mt-2">No model versions documented.</p>}
        </li>
      ))}</ul> : <p className="panel">No model families documented.</p>}
    </section>
    {lab.sources.length > 0 && <section className="panel mt-5"><h2>Sources</h2><ul className="detail-list">
      {lab.sources.map((source) => <li key={source.id}><SourceLink url={source.sourceUrl}>Lab identity source</SourceLink> · Observed {date(source.observedAt)}</li>)}
    </ul></section>}
  </main>;
}
