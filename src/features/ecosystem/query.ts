import { z } from "zod";
import { blank, pageLimit, pageNumber } from "../../lib/http/query";

const directory = {
  q: z.preprocess(blank, z.string().trim().max(120).optional()),
  page: pageNumber,
  limit: pageLimit,
};

export const labQuery = z.strictObject(directory);
export const providerQuery = z.strictObject({
  ...directory,
  availability: z.preprocess(blank, z.enum(["LISTED", "UNAVAILABLE", "UNKNOWN"]).optional()),
  capability: z.preprocess(blank, z.enum(["tool-calling", "structured-outputs"]).optional()),
});

export type LabQuery = z.output<typeof labQuery>;
export type ProviderQuery = z.output<typeof providerQuery>;
