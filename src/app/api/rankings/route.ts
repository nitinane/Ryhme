import { rankingQuery } from "@/features/benchmarks/query";
import { rankings } from "@/features/benchmarks/service";
import { queryObject } from "@/features/catalog/schemas/query";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request) {
  const input = rankingQuery.safeParse(queryObject(new URL(request.url).searchParams));
  if (!input.success) return apiError(400);
  try {
    const { data, meta, benchmark, cohort, categories } = await rankings(input.data);
    return Response.json({ data, meta: { ...meta, benchmark: benchmark ?? null, cohort: cohort ?? null, categories } });
  } catch {
    return apiError(503);
  }
}
