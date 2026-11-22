"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { displayScore, labColor, scoreLabel, scoreScale, type BenchmarkPoint } from "@/features/benchmarks/chart-data";
import { SourceLink } from "@/features/catalog/components/source-link";

export function StudioAnalysis({ title, metric, unit, direction, rows, rates, filteredCount, children }: {
  title: string; metric: string; unit: string; direction: "HIGHER" | "LOWER"; rows: BenchmarkPoint[];
  rates: { provider: string; observed: string; points: BenchmarkPoint[] } | null;
  filteredCount: number;
  children: ReactNode;
}) {
  const id = useId();
  const [slug, setSlug] = useState<string>();
  const selected = rows.find(row => row.slug === slug) ?? rows[0];
  const rateBySlug = new Map(rates?.points.map(row => [row.slug, row]));
  const plotted = rows.filter(row => rateBySlug.has(row.slug));
  const scoreDomain = scoreScale(rows, unit);
  const values = plotted.length ? plotted.map(row => Number(row.score)) : [0, 1];
  const min = Math.min(...values), max = Math.max(...values);
  const step = 10 ** Math.floor(Math.log10(max - min || Math.max(Math.abs(max) * .1, .01)));
  const low = Math.floor(min / step) * step;
  const high = Math.max(low + step, Math.ceil(max / step) * step);
  const maxPrice = Math.max(0, ...(rates?.points.map(row => Number(row.score)) ?? []));
  const priceCeiling = maxPrice > 0 ? maxPrice : 1;
  const selectedRate = selected && rateBySlug.get(selected.slug);
  const xPosition = (price: string) => `${100 * Number(price) / priceCeiling}%`;
  const yPosition = (score: string) => `${100 * (Number(score) - low) / (high - low)}%`;
  const tone = (row: BenchmarkPoint) => ({ "--studio-lab": labColor(row.labSlug ?? row.slug) }) as CSSProperties;

  return <div className="studio-analysis">
    <figure className="studio-board" aria-labelledby={`${id}-score-title`}>
      <figcaption className="studio-section-head">
        <div><h2 id={`${id}-score-title`}>{title}</h2><p>{metric} · {direction === "HIGHER" ? "Higher is better" : "Lower is better"}</p></div>
        <span className="studio-label">Score distribution</span>
      </figcaption>
      <div className="studio-table-wrap">
        <table className="studio-table">
          <thead><tr><th scope="col">Rank</th><th scope="col">Model / Lab</th>
            <th scope="col"><span className="sr-only">Score scale</span><div className="studio-ticks">
              {[0, .5, 1].map(fraction => <span key={fraction}>{displayScore(String(scoreDomain.min + (scoreDomain.max - scoreDomain.min) * fraction), unit)}</span>)}
            </div></th><th scope="col">Score</th></tr></thead>
          <tbody>{rows.map(row => {
            const position = scoreDomain.position(Number(row.score)), zero = scoreDomain.position(0);
            return <tr key={row.slug} data-selected={row.slug === selected?.slug} style={tone(row)}>
              <td>{row.rank ?? "—"}</td>
              <th scope="row"><button type="button" aria-pressed={row.slug === selected?.slug}
                aria-controls={`${id}-detail`} aria-describedby={`${id}-exact-${row.slug}`} onClick={() => setSlug(row.slug)}>
                <span className="studio-model-dot" aria-hidden="true" /><span>{row.name}<small>{row.labName}</small></span>
              </button><span id={`${id}-exact-${row.slug}`} className="sr-only">Exact score: {scoreLabel(row.score, unit)}</span></th>
              <td className="studio-bar-cell"><div className="studio-track" aria-hidden="true"><span style={{
                insetInlineStart: `${Math.min(position, zero)}%`, width: `${Math.abs(position - zero)}%`,
              }} /></div></td>
              <td className="studio-score" title={scoreLabel(row.score, unit)}>{displayScore(row.score, unit)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="studio-table-foot">
        <span>Showing <strong>{rows.length}</strong> of <strong>{filteredCount}</strong> matching scores</span>
        <span>Choose a model to inspect its evidence</span>
      </div>
    </figure>

    <aside className="studio-side" aria-label="Price and selected model evidence">
      <figure aria-labelledby={`${id}-price-title`}>
        <figcaption className="studio-section-head"><div><h2 id={`${id}-price-title`}>Price vs. score</h2>
          <p>{rates && plotted.length >= 2 ? `${rates.provider} · Historical USD / 1M input tokens` : "Historical USD / 1M input tokens"}</p></div></figcaption>
        {rates && plotted.length >= 2 ? <>
          <div className="studio-axis-caption">{metric} ({unit})</div>
          <div className="studio-scatter">
            <div className="studio-scatter-y" aria-hidden="true">{[high, (high + low) / 2, low].map(value => <span key={value}>{displayScore(String(value), unit)}</span>)}</div>
            <div className="studio-plot">
              {selected && selectedRate && <span className="studio-crosshair" aria-hidden="true"
                style={{ "--plot-x": xPosition(selectedRate.score), "--plot-y": yPosition(selected.score) } as CSSProperties} />}
              {plotted.map(row => {
              const price = rateBySlug.get(row.slug)!;
              const label = `${row.name}: ${scoreLabel(row.score, unit)}, USD ${price.score} per million input tokens`;
              return <button key={row.slug} className="studio-point" type="button" aria-label={label} title={label}
                aria-pressed={row.slug === selected?.slug} aria-controls={`${id}-detail`} onClick={() => setSlug(row.slug)}
                style={{ ...tone(row), left: xPosition(price.score), bottom: yPosition(row.score) }} />;
            })}</div>
            <div className="studio-scatter-x" aria-hidden="true">{[0, .5, 1].map(fraction => <span key={fraction}>${displayScore(String(priceCeiling * fraction), "$").replace(" $", "")}</span>)}</div>
          </div>
          <p className="studio-plot-note"><span>USD / 1M input tokens</span><span>{plotted.length} models · {rates.observed}</span></p>
        </> : <p className="studio-empty">Fewer than two models have input rates from the same provider, source, and observation time.</p>}
      </figure>
      {selected && <section className="studio-selection" id={`${id}-detail`} aria-live="polite" style={tone(selected)}>
        <p className="studio-label">Selected model</p>
        <div className="studio-selection-title"><span className="studio-model-dot" aria-hidden="true" /><Link href={`/models/${selected.slug}`}>{selected.name}</Link></div>
        <dl><div><dt>Exact score</dt><dd>{scoreLabel(selected.score, unit)}</dd></div>
          <div><dt>Input / 1M</dt><dd>{selectedRate ? `$${selectedRate.score}` : "—"}</dd></div></dl>
        <div className="studio-source-links"><SourceLink url={selected.sourceUrl}>Benchmark result source</SourceLink>
          {selectedRate && <SourceLink url={selectedRate.sourceUrl}>Historical price source</SourceLink>}</div>
      </section>}
      {children}
    </aside>
  </div>;
}
