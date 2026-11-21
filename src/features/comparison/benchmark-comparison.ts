import type { BenchmarkPoint } from "../benchmarks/chart-data";
import type { ModelDetail } from "../catalog/services/models";
import { estimateCost } from "./cost";

type Result = ModelDetail["results"][number];
type PricePoint = BenchmarkPoint & { cost: string; priceUrl: string };
type PriceGroup = { provider: string; currency: string; observedAt: Date; points: PricePoint[] };

export const benchmarkWorkload = { input: 1_000_000, output: 100_000 };

export function benchmarkCohortKey(result: Result) {
  return JSON.stringify([result.benchmarkId, result.sourceId, result.evaluationKey, result.methodologyVersion, result.evaluatedAt]);
}

export function benchmarkComparisons(models: ModelDetail[]) {
  const groups = new Map<string, { result: Result; points: BenchmarkPoint[]; prices: Map<string, PriceGroup> }>();
  for (const model of models) {
    for (const result of model.results) {
      if (result.verifiedStatus !== "VERIFIED") continue;
      const key = benchmarkCohortKey(result);
      const group = groups.get(key) ?? { result, points: [], prices: new Map<string, PriceGroup>() };
      groups.set(key, group);
      const point = { slug: model.slug, name: model.name, score: result.score.toString(), sourceUrl: result.sourceUrl };
      group.points.push(point);

      for (const offer of model.offerings) {
        const { price } = offer;
        if (offer.availabilityStatus !== "LISTED" || !price) continue;
        const cost = estimateCost(price, benchmarkWorkload.input, benchmarkWorkload.output);
        if (cost === null) continue;
        const priceKey = JSON.stringify([offer.provider.slug, price.currency, price.sourceId, price.observedAt]);
        const pricing = group.prices.get(priceKey) ?? {
          provider: offer.provider.name, currency: price.currency, observedAt: price.observedAt, points: [],
        };
        group.prices.set(priceKey, pricing);
        if (!pricing.points.some(({ slug }) => slug === point.slug)) {
          pricing.points.push({ ...point, cost, priceUrl: price.sourceUrl });
        }
      }
    }
  }

  return [...groups].flatMap(([key, group]) => group.points.length < 2 ? [] : [{
    key, result: group.result, points: group.points,
    prices: [...group.prices].flatMap(([key, pricing]) => pricing.points.length < 2 ? [] : [{ key, ...pricing }]),
  }]);
}
