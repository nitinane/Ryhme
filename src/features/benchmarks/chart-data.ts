export type BenchmarkPoint = {
  slug: string;
  name: string;
  score: string;
  sourceUrl: string;
  rank?: number;
};

export function scoreLabel(score: string, unit: string) {
  const value = score.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

export function scoreScale(points: BenchmarkPoint[], unit: string) {
  const values = points.map(({ score }) => Number(score));
  const min = Math.min(0, ...values);
  const max = Math.max(unit === "%" ? 100 : 0, ...values);
  const position = (value: number) => 100 * (value - min) / (max - min || 1);
  return { min, max, position };
}
