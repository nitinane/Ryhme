
import { PageNotice } from "@/components/editorial-page";
import Link from "next/link";

export default function EcosystemNotFound() {
  return <PageNotice title="Catalog record not found" message="Check the address or browse the directories.">
    <div className="flex flex-wrap gap-2"><Link className="button" href="/labs">AI labs</Link>
      <Link className="button" href="/providers">API providers</Link></div>
  </PageNotice>;
}
