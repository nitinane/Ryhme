import Link from "next/link";
import type { Metadata } from "next";
import { DirectoryFilters, DirectoryPages, InvalidDirectoryFilters } from "@/features/ecosystem/components/filters";
import { labQuery } from "@/features/ecosystem/query";
import { listLabs } from "@/features/ecosystem/service";

export const metadata: Metadata = { title: "AI labs | OneAtlas" };

export default async function LabsPage({ searchParams }: PageProps<"/labs">) {
  const raw = await searchParams;
  const input = labQuery.safeParse(raw);
  const result = input.success ? await listLabs(input.data) : null;
  return <main id="main-content" className="frame page">
    <div className="page-heading"><h1>AI labs</h1><p>Explore organizations that develop and publish model families.</p></div>
    {input.success && result ? <>
      <DirectoryFilters action="/labs" query={input.data} searchLabel="Search by lab name" />
      <p className="muted my-4" role="status">{result.meta.total} {result.meta.total === 1 ? "lab" : "labs"}</p>
      {result.data.length ? <ul className="directory-grid">{result.data.map((lab) => (
        <li key={lab.id} className="panel model-card">
          <h2><Link className="model-link" href={`/labs/${lab.slug}`}>{lab.name}</Link></h2>
          <p className="muted mt-2">{lab._count.families} model {lab._count.families === 1 ? "family" : "families"}</p>
          {lab.description && <p className="mt-2">{lab.description}</p>}
        </li>
      ))}</ul> : <p className="panel">No labs match this search or page.</p>}
      <DirectoryPages path="/labs" raw={raw} meta={result.meta} />
    </> : <InvalidDirectoryFilters path="/labs" />}
  </main>;
}
