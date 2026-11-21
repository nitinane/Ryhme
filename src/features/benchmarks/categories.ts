export const categoryLabels = {
  coding: "Coding",
  reasoning: "Reasoning",
  mathematics: "Mathematics",
  "vision-multimodal": "Vision and multimodal",
  "general-knowledge": "General knowledge",
  "instruction-following": "Instruction following",
  "long-context": "Long context",
  "creative-writing": "Creative writing",
  "speed-latency": "Speed and latency",
  "cost-efficiency": "Cost efficiency",
} as const;

export const rankingCategories = Object.keys(categoryLabels) as (keyof typeof categoryLabels)[];

export const evaluationOriginLabel = {
  INDEPENDENT: "Independent evaluation",
  PUBLISHER: "Publisher-reported evaluation",
  UNKNOWN: "Evaluator relationship unknown",
} as const;
