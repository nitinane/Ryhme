import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SourceLink } from "@/features/catalog/components/source-link";
import { availability, capabilityNames, date, list, modalityNames, number } from "@/features/catalog/presentation";
import { lifecycles } from "@/features/catalog/schemas/query";
import { findComparison, type ModelDetail } from "@/features/catalog/services/models";
import { CostCalculator } from "@/features/comparison/components/calculator";
import { BrowseForComparison } from "@/features/comparison/components/selection";
import { compareQuery } from "@/features/comparison/schemas/compare";
import { BenchmarkBars } from "@/features/benchmarks/components/benchmark-bars";
import { ScoreCostPlot } from "@/features/comparison/components/score-cost-plot";
import { benchmarkCohortKey, benchmarkComparisons } from "@/features/comparison/benchmark-comparison";

export const metadata: Metadata = { title: "Compare models | Ryhme" };
const unknown = "Unknown";

type Cell = { value: ReactNode; known?: string };
type Row = { label: string; cells: Cell[] };

function textCell(value: string | null): Cell {
  return value === null || value === unknown ? { value: unknown } : { value, known: value };
}

function rows(models: ModelDetail[]): { label: string; rows: Row[] }[] {
  const simple = [
    { label: "Lab / family", cell: (m: ModelDetail) => `${m.family.lab.name} / ${m.family.name}` },
    { label: "Lifecycle", cell: (m: ModelDetail) => lifecycles[m.lifecycle] },
    { label: "Release date", cell: (m: ModelDetail) => date(m.releaseDate) },
    { label: "Context (tokens)", cell: (m: ModelDetail) => number(m.contextTokens) },
    { label: "Input modalities", cell: (m: ModelDetail) => list(modalityNames(m.modalities, "input")) },
    { label: "Output modalities", cell: (m: ModelDetail) => list(modalityNames(m.modalities, "output")) },
    { label: "Capabilities", cell: (m: ModelDetail) => list(capabilityNames(m.capabilities)) },
    { label: "License", cell: (m: ModelDetail) => m.license },
    { label: "Open weights", cell: (m: ModelDetail) => m.openWeights === null ? null : m.openWeights ? "Yes" : "No" },
  ];
  const benchmarks = new Map<string, Row>();
  for (const [index, model] of models.entries()) {
    for (const result of model.results) {
      const key = benchmarkCohortKey(result);
      const row = benchmarks.get(key) ?? {
        label: [result.benchmark.name, result.methodologyVersion ?? result.benchmark.version, result.evaluationConfig]
          .filter(Boolean).join(" / "),
        cells: models.map(() => ({ value: "No score reported" })),
      };
      row.cells[index] = {
        known: result.score.toString(),
        value: <><strong>{result.score.toString()}{result.benchmark.unit === "%" ? "%" : ` ${result.benchmark.unit}`}</strong>
          <p className="muted text-sm"><SourceLink url={result.sourceUrl}>{result.source.name} result</SourceLink></p></>,
      };
      benchmarks.set(key, row);
    }
  }
  const pricing: Row[] = [
    {
      label: "Provider offerings",
      cells: models.map((model) => ({
        value: model.offerings.length ? <ul className="grid gap-2">{model.offerings.map((offer) => (
          <li key={offer.id}><SourceLink url={offer.sourceUrl}>{offer.provider.name}</SourceLink>
            <p className="muted text-sm">{availability[offer.availabilityStatus]}</p></li>
        ))}</ul> : unknown,
      })),
    },
    {
      label: "Historical pricing per 1M tokens",
      cells: models.map((model) => {
        const prices = model.offerings.filter((offer) => offer.price);
        const comparable = prices.length === 1 && models.every((other) => {
          const priced = other.offerings.filter((offer) => offer.price);
          return priced.length === 0 || (priced.length === 1 && priced[0].provider.slug === prices[0].provider.slug
            && priced[0].price!.currency === prices[0].price!.currency);
        });
        const price = prices[0]?.price;
        return {
          ...(comparable && price?.inputPerMillion != null && price.outputPerMillion != null
            ? { known: `${price.inputPerMillion}/${price.outputPerMillion}` } : {}),
          value: prices.length ? <ul className="grid gap-2">{prices.map((offer) => (
            <li key={offer.id}><SourceLink url={offer.price!.sourceUrl}>{offer.provider.name} · {offer.price!.currency}</SourceLink>
              <p>Input {offer.price!.inputPerMillion?.toString() ?? unknown} / output {offer.price!.outputPerMillion?.toString() ?? unknown}</p>
              <p className="muted text-sm">Observed {date(offer.price!.observedAt)}</p></li>
          ))}</ul> : unknown,
        };
      }),
    },
  ];
  return [
    { label: "Identity and capabilities", rows: simple.map(({ label, cell }) => ({ label, cells: models.map((model) => textCell(cell(model))) })) },
    { label: "Provider offerings and prices", rows: pricing },
    { label: "Benchmark evidence", rows: benchmarks.size > 0 ? [...benchmarks.values()] : [
      { label: "Published scores", cells: models.map(() => ({ value: "No score reported" })) },
    ] },
  ];
}

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const raw = await searchParams;
  const parsed = compareQuery.safeParse(raw);
  const models = parsed.success ? await findComparison(parsed.data.models) : null;
  const charts = models ? benchmarkComparisons(models) : [];

  return (
    <main id="main-content" tabIndex={-1} className="frame page">
      <div className="page-heading"><h1>Compare models</h1><p>See specifications, provider prices, and benchmark evidence side by side.</p></div>
      {!models ? <section className="panel">
        <h2>{Object.keys(raw).length === 0 ? "Choose two to four models" : "Comparison unavailable"}</h2>
        <p className="muted my-3">{parsed.success
          ? "At least one selected model is no longer in the catalog."
          : "Select two to four distinct model versions in the catalog to start a comparison."}</p>
        <Link className="button primary" href="/models">Browse model catalog</Link>
      </section> : <>
        <div className="comparison-tools">
          <nav aria-label="Comparison sections">
            <a className="text-link" href="#performance-comparison">Performance</a>
            <a className="text-link" href="#comparison-matrix">Specifications and prices</a>
            {models.some(({ offerings }) => offerings.length > 0) && <a className="text-link" href="#calculator">Cost estimator</a>}
          </nav>
          <BrowseForComparison models={models.map(({ id, name }) => ({ id, name }))} />
        </div>
        <section aria-labelledby="performance-comparison" className="mb-6">
          <h2 id="performance-comparison" className="mb-3">Benchmark comparison</h2>
          {charts.length === 0 ? <p className="panel muted">Select models with scores from a shared verified evaluation to compare performance.</p>
            : <div className="grid gap-2">{charts.map(({ key, result, points, prices }, index) => {
              const { benchmark } = result;
              return <details className="benchmark-disclosure" key={key} open={index === 0}>
                <summary>{benchmark.name} <span className="muted text-sm">· {result.methodologyVersion ?? benchmark.version ?? "Version unknown"}
                  {result.evaluationConfig && ` / ${result.evaluationConfig}`}</span></summary>
                <div className="comparison-charts">
                  <BenchmarkBars title="Benchmark scores" metric={benchmark.metricName} unit={benchmark.unit}
                    direction={benchmark.direction} methodology={benchmark.methodology} evidenceDate={date(result.evaluatedAt)}
                    points={points} missing={models.length - points.length} />
                  {prices.map(({ key: priceKey, provider, currency, observedAt, points }) => (
                    <ScoreCostPlot key={priceKey}
                      title={benchmark.name} unit={benchmark.unit} provider={provider} currency={currency} observed={date(observedAt)} points={points} />
                  ))}
                  {prices.length === 0 && <p className="panel muted">Score-versus-cost data is unavailable for the same provider, currency, and price observation date.</p>}
                </div>
              </details>;
            })}</div>}
        </section>
        <div id="comparison-matrix" className="matrix-scroll" tabIndex={0} role="region" aria-label="Scrollable model comparison">
          <table className="matrix">
            <caption className="sr-only">Specifications, offerings, pricing, and benchmark scores by model</caption>
            <thead><tr><th scope="col">Attribute</th>{models.map((model) => (
              <th scope="col" key={model.id}><Link className="text-link" href={`/models/${model.slug}`}>{model.name}</Link></th>
            ))}</tr></thead>
            {rows(models).map((section) => <tbody key={section.label}>
            <tr className="matrix-section"><td colSpan={models.length + 1}>{section.label}</td></tr>
            {section.rows.map((row, index) => {
              const different = new Set(row.cells.flatMap(({ known }) => known === undefined ? [] : [known])).size > 1;
              return <tr key={index}><th scope="row">{row.label}</th>{row.cells.map((cell, column) => (
                <td className={different && cell.known !== undefined ? "difference" : undefined} key={models[column].id}>
                  {cell.value}{different && cell.known !== undefined && <span className="sr-only"> (differs across models)</span>}
                </td>
              ))}</tr>;
            })}</tbody>)}
          </table>
        </div>
        {models.some(({ offerings }) => offerings.length > 0) && <CostCalculator key={models.map(({ id }) => id).join(",")} models={models.map((model) => ({
          id: model.id, name: model.name,
          offerings: model.offerings.map((offer) => ({ id: offer.id, provider: offer.provider.name, availabilityStatus: offer.availabilityStatus })),
        }))} />}
      </>}
    </main>
  );
}
