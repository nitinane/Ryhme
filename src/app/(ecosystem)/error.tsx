"use client";

import { PageNotice } from "@/components/editorial-page";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

export default function EcosystemError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return <PageNotice title="Catalog evidence unavailable" message="This page could not load its records." alert>
    <button className="button" type="button" onClick={() => startTransition(() => { router.refresh(); reset(); })}>Try again</button>
  </PageNotice>;
}
