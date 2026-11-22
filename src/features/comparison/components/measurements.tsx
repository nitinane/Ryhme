import { capabilities } from "@/features/catalog/schemas/query";
import { number, utcTime } from "@/features/catalog/presentation";
import { SourceLink } from "@/features/catalog/components/source-link";
import type { ModelDetail } from "@/features/catalog/services/models";

export function ComparisonSpecs({ models }: { models: ModelDetail[] }) {
  const maximum = Math.max(1, ...models.map(({ contextTokens }) => contextTokens ?? 0));
  return <section className="measurements-grid" aria-label="Model measurements">
    <div className="panel">
      <h2>Context windows</h2>
      <p className="muted text-sm">Documented maximum context in tokens</p>
      <ul className="measurement-list">{models.map(model => <li key={model.id}>
        <div><span>{model.name}</span><strong>{number(model.contextTokens)}</strong></div>
        {model.contextTokens !== null && <meter min={0} max={maximum} value={model.contextTokens} aria-label={`${model.name} context in tokens`} />}
      </li>)}</ul>
    </div>
    <div className="panel">
      <h2>Capability coverage</h2>
      <ul className="measurement-list">{models.map(model => <li key={model.id}>
        <strong>{model.name}</strong>
        <ul className="flex flex-wrap gap-2">{Object.entries(capabilities).map(([key, label]) => <li className="chip" key={key}>
          {label}: {Array.isArray(model.capabilities) ? model.capabilities.includes(key) ? "Listed" : "Not listed" : "Unknown"}
        </li>)}</ul>
      </li>)}</ul>
    </div>
  </section>;
}

export function PriceHistory({ models }: { models: ModelDetail[] }) {
  const series = models.flatMap(model => model.priceHistory.flatMap(offer => {
    const groups = new Map<string, typeof offer.prices>();
    for (const price of offer.prices) {
      if (price.inputPerMillion === null && price.outputPerMillion === null) continue;
      const key = `${price.currency}/${price.sourceId}`;
      groups.set(key, [...(groups.get(key) ?? []), price]);
    }
    return [...groups].filter(([, prices]) => prices.length >= 2)
      .map(([key, prices]) => ({ model, offer, key, prices: prices.reverse() }));
  }));
  return <section className="panel price-history" aria-label="Historical token prices">
    <h2>Historical token prices</h2>
    {series.length === 0 ? <p className="muted text-sm">A price trend needs at least two dated observations for the same offering, currency, and source.</p>
      : <div className="measurements-grid">{series.map(({ model, offer, key, prices }) => {
        const max = Math.max(1e-12, ...prices.flatMap(p => [Number(p.inputPerMillion ?? 0), Number(p.outputPerMillion ?? 0)]));
        return <div key={`${offer.id}/${key}`}>
          <h3>{model.name} / {offer.provider.name}</h3>
          <p className="muted text-sm">{offer.externalModelId} / {prices[0].currency} per 1M tokens</p>
          <ol className="measurement-list">{prices.map(price => <li key={price.id}>
            <SourceLink url={price.sourceUrl}><time dateTime={price.observedAt.toISOString()}>{utcTime(price.observedAt)}</time></SourceLink>
            {([["Input", price.inputPerMillion], ["Output", price.outputPerMillion]] as const).map(([label, value]) => <div key={label}>
              <span className="muted text-sm">{label} / {value?.toString() ?? "Unknown"}</span>
              {value !== null && <meter min={0} max={max} value={Number(value)} aria-label={`${label} token price at ${utcTime(price.observedAt)}`} />}
            </div>)}
          </li>)}</ol>
        </div>;
      })}</div>}
  </section>;
}
