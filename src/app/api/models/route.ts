import { catalogQuery, queryObject } from "@/features/catalog/schemas/query";
import { listModels } from "@/features/catalog/services/models";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request) {
  const query = catalogQuery.safeParse(queryObject(new URL(request.url).searchParams));
  if (!query.success) return apiError(400);
  try {
    return Response.json(await listModels(query.data));
  } catch {
    return apiError(503);
  }
}
