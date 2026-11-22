"use client";

import { type CSSProperties, useId, useState } from "react";
import { displayScore, labColor, scoreLabel, scoreScale, type BenchmarkPoint } from "@/features/benchmarks/chart-data";
import { SourceLink } from "@/features/catalog/components/source-link";

type CostPoint = BenchmarkPoint & { cost: string; priceUrl: string };

export function ScoreCostPlot({ title, unit, provider, currency, observed, points, tokenRate = false }: {
  title: string; unit: string; provider: string; currency: string; observed: string; points: CostPoint[]; tokenRate?: boolean;
}) {
  const id = useId();
  const [active, setActive] = useState<string>();
  const selected = points.find(({ slug }) => slug === active);
  const scale = scoreScale(points, unit);
  const maxCost = Math.max(...points.map(({ cost }) => Number(cost)));
  return <figure className="panel chart-panel" aria-labelledby={`${id}-title`}>
    <figcaption>
      <h2 id={`${id}-title`}>{title} score vs. {tokenRate ? "input token price" : "cost"}</h2>
      <p className="muted text-sm mt-1">{provider} · {tokenRate ? "Historical input rates in" : "Historical estimates in"} {currency} · Prices observed {observed}</p>
      <p className="muted text-sm">{tokenRate ? `${currency} per 1M input tokens` : "Workload: 1M input and 100k output tokens."}</p>
    </figcaption>
    <div className="scatter-chart">
      <div className="scatter-y" aria-hidden="true"><span>{scoreLabel(String(scale.max), unit)}</span><span>{scoreLabel(String(scale.min), unit)}</span></div>
      <div className="scatter-plot" aria-hidden="true">
        {points.map((point, index) => <span key={point.slug} className="scatter-dot" data-active={point.slug === active}
          style={{ "--lab-color": labColor(point.labSlug ?? point.slug), left: `${100 * Number(point.cost) / (maxCost || 1)}%`, bottom: `${scale.position(Number(point.score))}%` } as CSSProperties}>{index + 1}</span>)}
      </div>
      <div className="scatter-x" aria-hidden="true"><span>{currency} 0</span><span>{currency} {points.find(({ cost }) => Number(cost) === maxCost)?.cost}</span></div>
    </div>
    <ol className="scatter-key">
      {points.map((point, index) => <li key={point.slug}>
        <button type="button" className="chart-row" title={`Exact score: ${scoreLabel(point.score, unit)} · ${currency} ${point.cost}`} aria-pressed={point.slug === active} aria-controls={`${id}-evidence`} aria-describedby={`${id}-exact-${index}`}
          onClick={() => setActive(point.slug === active ? undefined : point.slug)}>
          <span className="chart-name"><span className="chart-rank">{index + 1}. </span><span className="chart-identity"><span>{point.name}</span>{point.labName && <small>{point.labName}</small>}</span></span>
          <strong>{displayScore(point.score, unit)} · {currency} {point.cost}</strong>
        </button>
        <span id={`${id}-exact-${index}`} className="sr-only">Exact score: {scoreLabel(point.score, unit)}. {currency} {point.cost}.</span>
      </li>)}
    </ol>
    <div id={`${id}-evidence`} className="chart-evidence text-sm" aria-live="polite" hidden={!selected}>
      {selected && <><p>Exact score: {scoreLabel(selected.score, unit)} · {currency} {selected.cost}</p><SourceLink url={selected.sourceUrl}>Benchmark result source</SourceLink> · <SourceLink url={selected.priceUrl}>Historical price source</SourceLink></>}
    </div>
  </figure>;
}
