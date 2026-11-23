import { EditorialSearch, EditorialWorkspace, PageHeading, PageShell } from "@/components/editorial-page";
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
  return { title: lab ? `${lab.name} lab | Rhyme` : "AI lab | Rhyme" };
}

export default async function LabPage({ params }: PageProps<"/labs/[slug]">) {
  const lab = await getLab((await params).slug);
  if (!lab) notFound();
  return <PageShell>
    <PageHeading title={lab.name} label={<Link href="/labs">AI labs</Link>} tools={
      <EditorialSearch label={`Search ${lab.name} models`} placeholder="Search this lab"><input type="hidden" name="lab" value={lab.slug} /></EditorialSearch>
    }>
      <p>{lab.description ?? "Model developer and publisher"}</p>
    </PageHeading>
    <EditorialWorkspace title="Model families" aside={<section className="studio-selection">
      <h2>Publisher evidence</h2>
      <dl><div><dt>Documented families</dt><dd>{lab.families.length}</dd></div></dl>
      {lab.website && <SourceLink url={lab.website}>Official lab website</SourceLink>}
      {lab.sources.length > 0 && <ul className="studio-source-links mt-2">{lab.sources.map(source => (
        <li key={source.id}><SourceLink url={source.sourceUrl}>Lab identity source</SourceLink> · Observed {date(source.observedAt)}</li>
      ))}</ul>}
    </section>}>
      {lab.families.length ? <ul className="directory-grid">{lab.families.map((family) => (
        <li key={family.id} className="panel">
          <h3>{family.name}</h3>
          {family.description && <p className="muted mt-2">{family.description}</p>}
          {family.versions.length ? <ul className="detail-list">{family.versions.map((model) => (
            <li key={model.id}>
              <Link className="text-link" href={`/models/${model.slug}`}>{model.canonicalName}</Link>
              <p className="muted text-sm">{lifecycles[model.lifecycle]} · {list(capabilityNames(model.capabilities))}</p>
              <p className="muted text-xs">Released {date(model.releaseDate)} · {model._count.results ? "Verified benchmark evidence" : "Unranked"}</p>
              {model.offerings.length > 0 && <div className="flex flex-wrap gap-2 text-sm">{model.offerings.map(({ provider }) => (
                <Link key={provider.slug} className="text-link" href={`/providers/${provider.slug}`}>{provider.name}</Link>
              ))}</div>}
            </li>
          ))}</ul> : <p className="muted mt-2">No model versions documented.</p>}
        </li>
      ))}</ul> : <p className="panel">No model families documented.</p>}
    </EditorialWorkspace>
  </PageShell>;
}
