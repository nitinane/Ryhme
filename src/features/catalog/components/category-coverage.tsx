import Link from "next/link";
import { number } from "../presentation";
import { capabilities, catalogCategories, type CatalogCategory } from "../schemas/query";
import type { CatalogBreakdown } from "../services/models";

const benchmarkDomains: Partial<Record<CatalogCategory, string>> = {
  text: "instruction-following",
  vision: "vision-multimodal",
  multimodal: "vision-multimodal",
  "tool-calling": "tool-use",
};

function Counts({ title, total, rows }: {
  title: string;
  total: number;
  rows: { label: string; count: number }[];
}) {
  return <figure>
    <figcaption>{title}</figcaption>
    <ul className="coverage-bars">
      {rows.map(({ label, count }) => <li key={label}>
        <span>{label}</span><span className="catalog-number">{number(count)}</span>
        <meter aria-hidden="true" min={0} max={total} value={count} />
      </li>)}
    </ul>
  </figure>;
}

export function CategoryCoverage({ category, total, breakdown }: {
  category: CatalogCategory;
  total: number;
  breakdown: CatalogBreakdown;
}) {
  if (!total) return null;
  const publishers = breakdown.publishers.map(({ name, slug, count }) => ({
    label: breakdown.publishers.some(item => item.name === name && item.slug !== slug) ? `${name} (${slug})` : name, count,
  }));
  const other = total - publishers.reduce((sum, { count }) => sum + count, 0);
  const domains = benchmarkDomains[category];
  const modalityRows = (direction: "input" | "output") => Object.entries(breakdown[direction])
    .filter(([, count]) => count > 0)
    .map(([mode, count]) => ({ label: `${mode[0].toUpperCase()}${mode.slice(1)} ${direction}`, count }));

  return <section className="studio-board catalog-coverage" aria-labelledby="catalog-coverage-title">
    <header className="studio-section-head"><div>
      <h2 id="catalog-coverage-title">{catalogCategories[category]} coverage</h2>
      <p>Model versions across all {number(total)} matching results. Modalities and capabilities can overlap.</p>
    </div></header>
    <div className="coverage-grid">
      <Counts title="Publishers" total={total} rows={other ? [...publishers, { label: "Other publishers", count: other }] : publishers} />
      <Counts title="Modality and capability metadata" total={total} rows={[
        ...modalityRows("input"), ...modalityRows("output"),
        ...Object.entries(capabilities).map(([key, label]) => ({ label, count: breakdown.capabilities[key] })),
        { label: "Input metadata unavailable", count: total - breakdown.inputMetadata },
        { label: "Output metadata unavailable", count: total - breakdown.outputMetadata },
        { label: "Capability metadata unavailable", count: total - breakdown.capabilityMetadata },
      ]} />
      <Counts title="Evidence coverage" total={total} rows={[
        { label: "Observed USD input rate", count: breakdown.priced },
        { label: "Observed USD output rate", count: breakdown.outputPriced },
        { label: "No observed USD token rate", count: total - breakdown.anyPriced },
        { label: "Verified benchmark evidence", count: breakdown.evaluated },
        { label: "No verified benchmark evidence", count: total - breakdown.evaluated },
      ]} />
    </div>
    <p className="muted text-sm">Source: Rhyme catalog records. Price coverage uses each listed offering’s latest observation in USD per million tokens. Benchmark coverage includes any verified evaluation.</p>
    {domains && <Link className="text-link text-sm" href={`/rankings?category=${domains}&catalogCategory=${category}`}>Explore comparable benchmark cohorts</Link>}
  </section>;
}
