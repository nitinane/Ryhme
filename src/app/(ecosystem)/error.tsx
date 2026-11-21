"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

export default function EcosystemError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return <main id="main-content" className="frame page">
    <h1>Catalog evidence unavailable</h1>
    <p className="muted my-4" role="alert">This page could not load its records.</p>
    <button className="button" type="button" onClick={() => startTransition(() => { router.refresh(); reset(); })}>Try again</button>
  </main>;
}
