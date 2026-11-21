import { z } from "zod";

export const launchUrl = "https://openai.com/index/gpt-4-1/";
export const launchDate = new Date("2025-04-14");
export const docsObservedAt = new Date("2026-11-20");

const price = z.string().regex(/^\d{1,10}\.\d{2}$/);
const catalog = z.array(z.strictObject({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  canonicalName: z.string().min(1),
  externalModelId: z.string().min(1),
  sourceUrl: z.url({ protocol: /^https$/ }),
  contextTokens: z.number().int().positive(),
  lifecycle: z.enum(["DEPRECATED", "RETIRED"]),
  inputPerMillion: price,
  outputPerMillion: price,
  sweBenchScore: z.number().min(0).max(100).nullable(),
  gpqaScore: z.number().min(0).max(100),
  aimeScore: z.number().min(0).max(100),
}));

export const models = catalog.parse([
  {
    slug: "gpt-4-1-2025-04-14",
    canonicalName: "GPT-4.1",
    externalModelId: "gpt-4.1-2025-04-14",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-4.1",
    contextTokens: 1_047_576,
    lifecycle: "DEPRECATED",
    inputPerMillion: "2.00",
    outputPerMillion: "8.00",
    sweBenchScore: 54.6,
    gpqaScore: 66.3,
    aimeScore: 48.1,
  },
  {
    slug: "gpt-4-1-mini-2025-04-14",
    canonicalName: "GPT-4.1 mini",
    externalModelId: "gpt-4.1-mini-2025-04-14",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
    contextTokens: 1_047_576,
    lifecycle: "DEPRECATED",
    inputPerMillion: "0.40",
    outputPerMillion: "1.60",
    sweBenchScore: 23.6,
    gpqaScore: 65.0,
    aimeScore: 49.6,
  },
  {
    slug: "gpt-4-1-nano-2025-04-14",
    canonicalName: "GPT-4.1 nano",
    externalModelId: "gpt-4.1-nano-2025-04-14",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-4.1-nano",
    contextTokens: 1_047_576,
    lifecycle: "RETIRED",
    inputPerMillion: "0.10",
    outputPerMillion: "0.40",
    sweBenchScore: null,
    gpqaScore: 50.3,
    aimeScore: 29.4,
  },
]);
