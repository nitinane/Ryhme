import Link from "next/link";

export default function ModelNotFound() {
  return <main id="main-content" className="frame page"><h1>Model not found</h1>
    <p className="muted my-4">The catalog has no model version at this address.</p>
    <Link className="button" href="/models">Browse catalog</Link>
  </main>;
}
