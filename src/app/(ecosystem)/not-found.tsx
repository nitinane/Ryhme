import Link from "next/link";

export default function EcosystemNotFound() {
  return <main id="main-content" className="frame page"><h1>Catalog record not found</h1>
    <p className="muted my-4">Check the address or browse the directories.</p>
    <div className="flex flex-wrap gap-2"><Link className="button" href="/labs">AI labs</Link>
      <Link className="button" href="/providers">API providers</Link></div>
  </main>;
}
