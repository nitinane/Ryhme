import { EditorialWorkspace, PageHeading, PageShell } from "@/components/editorial-page";
import Link from "next/link";
import type { Metadata } from "next";
import { DirectoryFilters, DirectoryPages, InvalidDirectoryFilters } from "@/features/ecosystem/components/filters";
import { labQuery } from "@/features/ecosystem/query";
import { listLabs } from "@/features/ecosystem/service";

export const metadata: Metadata = { title: "AI labs | Rhyme" };

export default async function LabsPage({ searchParams }: PageProps<"/labs">) {
  const raw = await searchParams;
  const input = labQuery.safeParse(raw);
  const result = input.success ? await listLabs(input.data) : null;
  return <PageShell>
    <PageHeading title="AI" accent="labs" label="Developer directory" tools={input.success &&
      <DirectoryFilters action="/labs" query={input.data} searchLabel="Search by lab name" />}>
      <p>Explore organizations that develop and publish model families.</p>
    </PageHeading>
    {input.success && result ? <>
      <EditorialWorkspace title="Developers" aside={<section className="studio-selection">
        <h2>Directory coverage</h2><dl><div><dt>Matching labs</dt>
          <dd role="status">{result.meta.total} {result.meta.total === 1 ? "lab" : "labs"}</dd></div></dl>
      </section>}>
      {result.data.length ? <ul className="editorial-records">{result.data.map((lab) => (
        <li key={lab.id}>
          <div><h3><Link className="text-link" href={`/labs/${lab.slug}`}>{lab.name}</Link></h3>
          {lab.description && <p className="muted">{lab.description}</p>}</div>
          <span className="studio-label">{lab._count.families} model {lab._count.families === 1 ? "family" : "families"}</span>
        </li>
      ))}</ul> : <p className="panel">No labs match this search or page.</p>}
      <DirectoryPages path="/labs" raw={raw} meta={result.meta} />
      </EditorialWorkspace>
    </> : <InvalidDirectoryFilters path="/labs" />}
  </PageShell>;
}
