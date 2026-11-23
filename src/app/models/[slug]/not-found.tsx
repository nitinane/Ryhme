
import { PageNotice } from "@/components/editorial-page";
import Link from "next/link";

export default function ModelNotFound() {
  return <PageNotice title="Model not found" message="The catalog has no model version at this address.">
    <Link className="button" href="/models">Browse catalog</Link>
  </PageNotice>;
}
