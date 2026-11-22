"use client";

import Link from "next/link";
import { type CSSProperties, useId, useState } from "react";
import { SourceLink } from "@/features/catalog/components/source-link";
import { displayScore, labColor, scoreLabel, scoreScale, type BenchmarkPoint } from "../chart-data";

export function BenchmarkBars({ title, metric, unit, direction, methodology, evidenceDate, points, missing = 0, sourceLabel = "Benchmark result source" }: {
  title: string;
  metric: string;
  unit: string;
  direction: "HIGHER" | "LOWER";
  methodology: string;
  evidenceDate: string;
  points: BenchmarkPoint[];
  missing?: number;
  sourceLabel?: string;
}) {
  const id = useId();
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const [dismissedTooltip, setDismissedTooltip] = useState<string>();
  const selected = points.find(({ slug }) => slug === selectedSlug);
  const scale = scoreScale(points, unit);
  const zero = scale.position(0);
  const ticks = scale.min === scale.max ? [scale.min]
    : unit === "%" && scale.min === 0 && scale.max === 100 ? [0, 25, 50, 75, 100]
    : [scale.min, scale.min + (scale.max - scale.min) / 2, scale.max];

  return <figure className="panel chart-panel" aria-labelledby={`${id}-title`}>
    <figcaption>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="muted text-sm mt-1">{metric} ({unit}) · {direction === "HIGHER" ? "Higher is better" : "Lower is better"}</p>
    </figcaption>
    {points.length === 0 ? <p className="muted mt-4">No comparable scores for this view.</p> : <>
      <ul className="chart-bars" data-grid={ticks.length}>
        {points.map((point) => {
          const position = scale.position(Number(point.score));
          const tooltip = `${id}-score-${point.slug}`;
          return <li key={point.slug} style={{ "--lab-color": labColor(point.labSlug ?? point.labName ?? point.slug) } as CSSProperties}>
            <button type="button" className="chart-row" aria-describedby={tooltip} aria-pressed={selected?.slug === point.slug}
              aria-controls={`${id}-evidence`}
              onFocus={() => setDismissedTooltip(undefined)} onPointerEnter={() => setDismissedTooltip(undefined)}
              onKeyDown={(event) => { if (event.key === "Escape") setDismissedTooltip(point.slug); }}
              onClick={() => setSelectedSlug(selected?.slug === point.slug ? undefined : point.slug)}>
              <span className="chart-name">{point.rank !== undefined && <span className="chart-rank">#{point.rank} </span>}<span className="chart-identity"><span>{point.name}</span>{point.labName && <small>{point.labName}</small>}</span></span>
              <span className="chart-track" aria-hidden="true"><span className="chart-bar"
                style={{ insetInlineStart: `${Math.min(position, zero)}%`, width: `${Math.abs(position - zero)}%` }} /></span>
              <strong>{displayScore(point.score, unit, unit === "%" ? 2 : 4)}</strong>
            </button>
            <span id={tooltip} role="tooltip" className="chart-tooltip" data-dismissed={dismissedTooltip === point.slug}>
              Exact value: {scoreLabel(point.score, unit)}
            </span>
          </li>;
        })}
      </ul>
      <div className="chart-axis" aria-hidden="true"><div data-ticks={ticks.length}>
        {ticks.map((tick) => <span key={tick}>{displayScore(String(tick), unit, 3)}</span>)}
      </div></div>
    </>}
    {missing > 0 && <p className="muted text-sm mt-3">{missing} {missing === 1 ? "model" : "models"} without a comparable score.</p>}
    <div id={`${id}-evidence`} aria-live="polite" className="chart-evidence" hidden={!selected}>
      {selected && <>
        <p><Link className="text-link" href={`/models/${selected.slug}`}>{selected.name}</Link> · {scoreLabel(selected.score, unit)}</p>
        <p className="muted text-sm mt-1">{selected.evidence ?? methodology}{evidenceDate && ` Evaluation date: ${evidenceDate}.`}</p>
        <p className="mt-1 text-sm"><SourceLink url={selected.sourceUrl}>{sourceLabel}</SourceLink></p>
      </>}
    </div>
  </figure>;
}
