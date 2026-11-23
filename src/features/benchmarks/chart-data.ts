export type BenchmarkPoint = {
  slug: string;
  name: string;
  score: string;
  sourceUrl: string;
  rank?: number;
  labName?: string;
  labSlug?: string;
  evidence?: string;
};

export function scoreLabel(score: string, unit: string) {
  const value = score.replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  return unit && unit !== "%" ? `${value} ${unit}` : value + unit;
}

export function scoreScale(points: BenchmarkPoint[], unit: string) {
  const values = points.map(({ score }) => Number(score));
  const percentage = unit === "%" && values.every(value => value >= 0 && value <= 100);
  const min = Math.min(0, ...values);
  const max = Math.max(percentage ? 100 : 0, ...values);
  const position = (value: number) => 100 * (value - min) / (max - min || 1);
  const description = percentage ? "Percentage scale, 0 to 100%" : "Comparative scale includes zero and the plotted scores";
  return { min, max, position, description };
}

const labColors: Record<string, string> = {
  openai: "#00a979", anthropic: "#c56d46", google: "#2646a4", meta: "#765299",
  mistral: "#f6b720", qwen: "#ff705c", alibaba: "#ff705c", deepseek: "#3475bc",
};
const labAliases: Record<string, string> = { "google-deepmind": "google", "meta-llama": "meta", mistralai: "mistral" };
const otherColors = ["#a34579", "#537834", "#95633f", "#008197", "#775ac0", "#b34c66"];

export function labColor(slug: string) {
  const normalized = slug.replace(/-openrouter$/, "");
  const key = Object.hasOwn(labAliases, normalized) ? labAliases[normalized] : normalized;
  if (Object.hasOwn(labColors, key)) return labColors[key];
  let index = 0;
  for (const char of key) index = (31 * index + char.charCodeAt(0)) % otherColors.length;
  return otherColors[index];
}

export function displayScore(score: string, unit: string, digits = 2) {
  const value = Number(score);
  const rounded = value.toFixed(digits);
  return scoreLabel(value !== 0 && Number(rounded) === 0 ? value.toPrecision(2) : rounded, unit);
}
