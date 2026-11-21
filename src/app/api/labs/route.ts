import { queryObject } from "@/features/catalog/schemas/query";
import { labQuery } from "@/features/ecosystem/query";
import { listLabs } from "@/features/ecosystem/service";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request) {
  const input = labQuery.safeParse(queryObject(new URL(request.url).searchParams));
  if (!input.success) return apiError(400);
  try {
    return Response.json(await listLabs(input.data));
  } catch {
    return apiError(503);
  }
}
