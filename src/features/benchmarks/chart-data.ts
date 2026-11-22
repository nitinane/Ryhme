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
  return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

export function scoreScale(points: BenchmarkPoint[], unit: string) {
  const values = points.map(({ score }) => Number(score));
  const min = Math.min(0, ...values);
  const max = Math.max(unit === "%" ? 100 : 0, ...values);
  const position = (value: number) => 100 * (value - min) / (max - min || 1);
  return { min, max, position };
}

const labColors: Record<string, string> = {
  openai: "#008477", anthropic: "#bd5939", google: "#386bda", meta: "#5264ca",
  mistral: "#b46d14", qwen: "#8b49bd", alibaba: "#8b49bd", deepseek: "#3475bc",
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
