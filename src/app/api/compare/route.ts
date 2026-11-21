import { findComparison } from "@/features/catalog/services/models";
import { compareApiQuery } from "@/features/comparison/schemas/compare";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = compareApiQuery.safeParse({ modelId: params.getAll("modelId") });
  if (!query.success || Array.from(params.keys()).some((key) => key !== "modelId")) return apiError(400);
  try {
    const models = await findComparison(query.data.modelId);
    return models ? Response.json({ data: models }) : apiError(404);
  } catch {
    return apiError(503);
  }
}
