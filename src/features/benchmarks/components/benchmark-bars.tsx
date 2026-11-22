"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { SourceLink } from "@/features/catalog/components/source-link";
import { scoreLabel, scoreScale, type BenchmarkPoint } from "../chart-data";

export function BenchmarkBars({ title, metric, unit, direction, methodology, evidenceDate, points, missing = 0, compactScores = false }: {
  title: string;
  metric: string;
  unit: string;
  direction: "HIGHER" | "LOWER";
  methodology: string;
  evidenceDate: string;
  points: BenchmarkPoint[];
  missing?: number;
  compactScores?: boolean;
}) {
  const id = useId();
  const [selectedSlug, setSelectedSlug] = useState<string>();
  const selected = points.find(({ slug }) => slug === selectedSlug);
  const scale = scoreScale(points, unit);
  const zero = scale.position(0);
  const ticks = scale.min === scale.max ? [scale.min]
    : unit === "%" && scale.min === 0 && scale.max === 100 ? [0, 25, 50, 75, 100] : [scale.min, scale.max];

  return <figure className="panel chart-panel" aria-labelledby={`${id}-title`}>
    <figcaption>
      <h2 id={`${id}-title`}>{title}</h2>
      <p className="muted text-sm mt-1">{metric} ({unit}) · {direction === "HIGHER" ? "Higher is better" : "Lower is better"}</p>
    </figcaption>
    {points.length === 0 ? <p className="muted mt-4">No comparable scores for this view.</p> : <>
      <ul className="chart-bars">
        {points.map((point) => {
          const position = scale.position(Number(point.score));
          return <li key={point.slug}>
            <button type="button" className="chart-row" title={compactScores ? scoreLabel(point.score, unit) : undefined} aria-pressed={selected?.slug === point.slug}
              aria-controls={`${id}-evidence`} onClick={() => setSelectedSlug(selected?.slug === point.slug ? undefined : point.slug)}>
              <span className="chart-name">{point.rank !== undefined && <span className="chart-rank">#{point.rank} </span>}{point.name}</span>
              <span className="chart-track" aria-hidden="true"><span className="chart-bar"
                style={{ insetInlineStart: `${Math.min(position, zero)}%`, width: `${Math.abs(position - zero)}%` }} /></span>
              <strong>{scoreLabel(compactScores ? Number(point.score).toFixed(2) : point.score, unit)}</strong>
            </button>
          </li>;
        })}
      </ul>
      <div className="chart-axis" aria-hidden="true"><div>
        {ticks.map((tick) => <span key={tick}>{scoreLabel(String(tick), unit)}</span>)}
      </div></div>
    </>}
    {missing > 0 && <p className="muted text-sm mt-3">{missing} {missing === 1 ? "model" : "models"} without a comparable score.</p>}
    <div id={`${id}-evidence`} aria-live="polite" className="chart-evidence" hidden={!selected}>
      {selected && <>
        <p><Link className="text-link" href={`/models/${selected.slug}`}>{selected.name}</Link> · {scoreLabel(selected.score, unit)}</p>
        <p className="muted text-sm mt-1">{methodology} Evaluation date: {evidenceDate}.</p>
        <p className="mt-1 text-sm"><SourceLink url={selected.sourceUrl}>Benchmark result source</SourceLink></p>
      </>}
    </div>
  </figure>;
}
