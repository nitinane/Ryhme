import Link from "next/link";
import { PageHeading, PageShell } from "@/components/editorial-page";

export default function NotFound() {
  return <PageShell>
    <PageHeading title="Page not found"><p>This address does not match a Rhyme page.</p></PageHeading>
    <Link className="button" href="/">Back to Rhyme</Link>
  </PageShell>;
}
