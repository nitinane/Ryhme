"use client";

import { PageNotice } from "@/components/editorial-page";

export default function ComparisonError({ reset }: { reset: () => void }) {
  return <PageNotice title="Comparison unavailable" message="The selected models could not be loaded." alert>
    <button className="button" type="button" onClick={reset}>Try again</button>
  </PageNotice>;
}
