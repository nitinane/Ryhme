import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { evaluationOriginLabel } from "@/features/benchmarks/categories";
import { SourceLink } from "@/features/catalog/components/source-link";
import { availability, capabilityNames, date, list, modalityNames, number, utcTime } from "@/features/catalog/presentation";
import { lifecycles, slug } from "@/features/catalog/schemas/query";
import { findModel } from "@/features/catalog/services/models";
import { PriceHistory } from "@/features/comparison/components/measurements";
import { CompareToggle } from "@/features/comparison/components/selection";

export const dynamic = "force-dynamic";

const modelForSlug = cache(async (value: string) => {
  if (!slug.safeParse(value).success) return null;
  return findModel(value);
});

export async function generateMetadata({ params }: PageProps<"/models/[slug]">): Promise<Metadata> {
  const model = await modelForSlug((await params).slug);
  return { title: model ? `${model.name} | Ryhme` : "Model details | Ryhme" };
}

export default async function ModelPage({ params }: PageProps<"/models/[slug]">) {
  const model = await modelForSlug((await params).slug);
  if (!model) notFound();
  return (
    <main id="main-content" className="frame page">
      <Link className="text-link text-sm" href="/models">← Model catalog</Link>
      <div className="page-heading flex flex-wrap items-end justify-between gap-4">
        <div>
          <p><Link className="text-link" href={`/labs/${model.family.lab.slug}`}>{model.family.lab.name}</Link> / {model.family.name}</p>
          <h1>{model.name}</h1>
          <span className="chip mt-3 inline-block">{lifecycles[model.lifecycle]}</span>
          {model.recentlyAdded && <span className="chip ml-2 inline-block">New to Ryhme</span>}
        </div>
        <CompareToggle id={model.id} name={model.name} />
      </div>
      <div className="detail-grid">
        <section className="panel" aria-labelledby="specs">
          <h2 id="specs">Specifications</h2>
          <dl className="fact-list">
            <div><dt>Last updated</dt><dd><time dateTime={model.updatedAt.toISOString()}>{utcTime(model.updatedAt)}</time></dd></div>
            <div><dt>Released</dt><dd>{date(model.releaseDate)}</dd></div>
            <div><dt>Context window</dt><dd>{number(model.contextTokens)}{model.contextTokens === null ? "" : " tokens"}</dd></div>
            <div><dt>Input modalities</dt><dd>{list(modalityNames(model.modalities, "input"))}</dd></div>
            <div><dt>Output modalities</dt><dd>{list(modalityNames(model.modalities, "output"))}</dd></div>
            <div><dt>Capabilities</dt><dd>{list(capabilityNames(model.capabilities))}</dd></div>
            <div><dt>License</dt><dd>{model.license ?? "Unknown"}</dd></div>
            <div><dt>Open weights</dt><dd>{model.openWeights === null ? "Unknown" : model.openWeights ? "Yes" : "No"}</dd></div>
          </dl>
        </section>
        <section className="panel" aria-labelledby="versions">
          <h2 id="versions">Versions in this family</h2>
          <ul className="mt-3 grid gap-3">
            {model.versions.map((version) => <li key={version.id} className="flex flex-wrap justify-between gap-2">
              {version.id === model.id
                ? <span aria-current="page">{version.canonicalName} <span className="muted">(this version)</span></span>
                : <Link className="text-link" href={`/models/${version.slug}`}>{version.canonicalName}</Link>}
              <span className="muted">{date(version.releaseDate)}</span>
            </li>)}
          </ul>
        </section>
        <section className="panel detail-wide" aria-labelledby="offerings">
          <h2 id="offerings">Provider offerings</h2>
          {model.offerings.length === 0 ? <p className="muted mt-2">No provider offerings documented.</p> :
            <ul className="detail-list">
              {model.offerings.map((offer) => <li key={offer.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3><Link className="text-link" href={`/providers/${offer.provider.slug}`}>{offer.provider.name}</Link></h3>
                  <span className="chip">{availability[offer.availabilityStatus]}</span>
                </div>
                <p className="muted mt-2 break-all">{offer.externalModelId}</p>
                {offer.contextOverride !== null && <p>Provider context limit {number(offer.contextOverride)} tokens</p>}
                {offer.inputTokenLimit !== null && <p>Provider input limit {number(offer.inputTokenLimit)} tokens</p>}
                {offer.outputTokenLimit !== null && <p>Provider output limit {number(offer.outputTokenLimit)} tokens</p>}
                <p className="mt-2"><SourceLink url={offer.sourceUrl}>Offering source</SourceLink> ({offer.source.name}) · Observed <time dateTime={offer.observedAt.toISOString()}>{utcTime(offer.observedAt)}</time></p>
                {offer.catalogMissingSince && offer.availabilityStatus === "LISTED" && <p className="muted">Not seen in the latest catalog snapshot.</p>}
                {offer.price ? <div className="mt-3">
                  <p className="font-semibold">Historical pricing · {offer.price.currency} per 1M tokens</p>
                  <p>Input {offer.price.inputPerMillion?.toString() ?? "Unknown"} · Output {offer.price.outputPerMillion?.toString() ?? "Unknown"}</p>
                  <p className="muted"><SourceLink url={offer.price.sourceUrl}>Price source</SourceLink> · Observed {utcTime(offer.price.observedAt)}</p>
                </div> : <p className="muted mt-2">Pricing unknown.</p>}
              </li>)}
            </ul>}
        </section>
        <section className="panel" aria-labelledby="benchmarks">
          <h2 id="benchmarks">Benchmark evidence</h2>
          {model.verifiedResults === 0 && <p className="muted mt-2">Unranked · No verified benchmark scores for this version.</p>}
          {model.results.length > 0 &&
            <ul className="detail-list">
              {model.results.map((result) => <li key={result.id}>
                <h3>{result.benchmark.name}</h3>
                <p className="mt-1"><strong>{result.score.toString()}{result.benchmark.unit === "%" ? "%" : ` ${result.benchmark.unit}`}</strong> · {result.benchmark.metricName}</p>
                <p className="muted">{result.benchmark.direction === "HIGHER" ? "Higher is better" : "Lower is better"} · Evaluation date {date(result.evaluatedAt)}</p>
                <p className="muted">{evaluationOriginLabel[result.evaluationOrigin]}
                  {result.evaluationConfig && ` / ${result.evaluationConfig}`}</p>
                {result.publishedAt && <p className="muted">Archive published {date(result.publishedAt)}</p>}
                <p className="muted mt-2">{result.benchmark.methodology}</p>
                <p className="mt-2"><SourceLink url={result.sourceUrl}>{result.source.name} result</SourceLink> · {result.verifiedStatus.toLowerCase()} source attribution</p>
              </li>)}
            </ul>}
        </section>
        <section className="panel" aria-labelledby="sources">
          <h2 id="sources">Sources and freshness</h2>
          {model.identities.length > 0 && <ul className="detail-list">
            {model.identities.map(identity => <li key={JSON.stringify([identity.sourceId, identity.externalId, identity.revision])}>
              <p>{identity.source.name} · <code className="break-all">{identity.externalId}</code></p>
              <p className="muted text-sm">Revision <code className="break-all">{identity.revision}</code>
                {identity.source.catalogSyncedAt && <> · Source synced {utcTime(identity.source.catalogSyncedAt)}</>}</p>
            </li>)}
          </ul>}
          {model.sources.length === 0 ? <p className="muted mt-2">No source observations recorded.</p> :
            <ul className="detail-list">
              {model.sources.map((source) => <li key={source.id}>
                <SourceLink url={source.sourceUrl}>{source.source.name} · {source.field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}</SourceLink>
                <p className="muted text-sm">{source.entityType.replace(/([a-z])([A-Z])/g, "$1 $2")} · {date(source.observedAt)} · {source.verificationStatus.toLowerCase()}</p>
              </li>)}
            </ul>}
        </section>
      </div>
      <PriceHistory models={[model]} />
    </main>
  );
}
