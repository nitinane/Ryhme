import { z } from "zod";

const id = z.string().max(60).regex(/^[a-zA-Z0-9_-]+$/);
const distinctIds = z.array(id).min(2).max(4)
  .refine((ids) => new Set(ids).size === ids.length, "Choose distinct models or offerings.");

export const compareQuery = z.strictObject({
  models: z.string().max(243).transform((value) => value.split(",")).pipe(distinctIds),
});

export const compareApiQuery = z.strictObject({ modelId: distinctIds });

export const tokenLimit = 1_000_000_000_000;
const tokens = z.number().int().min(0).max(tokenLimit);
export const costRequest = z.strictObject({
  offeringIds: z.array(id).min(1).max(4).refine((ids) => new Set(ids).size === ids.length),
  inputTokens: tokens,
  outputTokens: tokens,
});
