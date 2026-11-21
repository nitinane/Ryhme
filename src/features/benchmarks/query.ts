import { z } from "zod";
import { slug } from "../catalog/schemas/query";
import { blank, pageLimit, pageNumber } from "../../lib/http/query";

export const rankingQuery = z.strictObject({
  category: slug.optional(),
  benchmark: z.preprocess(blank, slug.optional()),
  cohort: z.preprocess(blank, z.string().max(60).regex(/^[A-Za-z0-9_-]+$/).optional()),
  provider: z.preprocess(blank, slug.optional()),
  lab: z.preprocess(blank, slug.optional()),
  model: z.preprocess(blank, slug.optional()),
  sort: z.enum(["best", "worst"]).default("best"),
  page: pageNumber,
  limit: pageLimit,
});

export type RankingQuery = z.output<typeof rankingQuery>;

export function scoreDirection(direction: "LOWER" | "HIGHER") {
  return direction === "LOWER" ? "ASC" : "DESC";
}

export function categoryName(category: string) {
  return category.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}
