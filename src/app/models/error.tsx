"use client";

import { PageNotice } from "@/components/editorial-page";

export default function CatalogError({ reset }: { reset: () => void }) {
  return <PageNotice title="Catalog unavailable" message="Model records could not be read from the configured database." alert>
    <button className="button" type="button" onClick={reset}>Try again</button>
  </PageNotice>;
}
