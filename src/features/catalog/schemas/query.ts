import { z } from "zod";

export const slug = z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const capabilities = {
  "tool-calling": "Tool calling",
  "structured-outputs": "Structured outputs",
} as const;
export const lifecycles = {
  ACTIVE: "Active", DEPRECATED: "Deprecated", RETIRED: "Retired", UNKNOWN: "Unknown",
} as const;
export const catalogCategories = {
  text: "Text generation",
  vision: "Image input",
  multimodal: "Multimodal input",
  image: "Image generation",
  video: "Video generation",
  audio: "Audio input",
  "audio-output": "Audio output",
  "tool-calling": "Tool calling",
} as const;
export const evidenceStatuses = { evaluated: "Verified benchmark evidence", unevaluated: "No verified benchmark evidence" } as const;
export const pricingStatuses = { documented: "Observed USD input price", undocumented: "No observed USD input price" } as const;
export type CatalogCategory = keyof typeof catalogCategories;
export const catalogCategory = z.enum(Object.keys(catalogCategories) as CatalogCategory[]);

const blank = (value: unknown) => value === "" ? undefined : value;
const integer = z.string().regex(/^\d{1,10}$/).transform(Number);

export const catalogQuery = z.strictObject({
  q: z.string().trim().max(120).optional(),
  family: z.preprocess(blank, slug.optional()),
  lab: z.preprocess(blank, slug.optional()),
  provider: z.preprocess(blank, slug.optional()),
  capability: z.preprocess(blank, z.enum(["tool-calling", "structured-outputs"]).optional()),
  modality: z.preprocess(blank, z.enum(["text", "image", "audio", "video"]).optional()),
  category: z.preprocess(blank, catalogCategory.optional()),
  evidence: z.preprocess(blank, z.enum(["evaluated", "unevaluated"]).optional()),
  pricing: z.preprocess(blank, z.enum(["documented", "undocumented"]).optional()),
  openWeights: z.preprocess(blank, z.enum(["true", "false"]).transform((value) => value === "true").optional()),
  license: z.preprocess(blank, z.string().max(100).optional()),
  availability: z.preprocess(blank, z.enum(["LISTED", "UNAVAILABLE", "UNKNOWN"]).optional()),
  lifecycle: z.preprocess(blank, z.enum(["ACTIVE", "DEPRECATED", "RETIRED", "UNKNOWN"]).optional()),
  minContext: z.preprocess(blank, integer.pipe(z.number().max(2_147_483_647)).optional()),
  maxInputPrice: z.preprocess(blank, z.string().regex(/^\d{1,8}(?:\.\d{1,8})?$/).optional()),
  sort: z.enum(["name", "release", "context", "price", "discovered"]).default("name"),
  page: integer.pipe(z.number().min(1).max(10_000)).default(1),
  limit: integer.pipe(z.number().min(1).max(100)).default(20),
});

export type CatalogQuery = z.output<typeof catalogQuery>;

export function queryObject(params: URLSearchParams) {
  const entries = new Map<string, string | string[]>();
  for (const [key, value] of params) {
    const previous = entries.get(key);
    entries.set(key, previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value]);
  }
  return Object.fromEntries(entries);
}
