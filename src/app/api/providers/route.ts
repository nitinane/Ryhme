import { queryObject } from "@/features/catalog/schemas/query";
import { providerQuery } from "@/features/ecosystem/query";
import { listProviders } from "@/features/ecosystem/service";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request) {
  const input = providerQuery.safeParse(queryObject(new URL(request.url).searchParams));
  if (!input.success) return apiError(400);
  try {
    return Response.json(await listProviders(input.data));
  } catch {
    return apiError(503);
  }
}
