import { slug, queryObject } from "@/features/catalog/schemas/query";
import { providerQuery } from "@/features/ecosystem/query";
import { findProvider } from "@/features/ecosystem/service";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request, context: RouteContext<"/api/providers/[slug]">) {
  const param = slug.safeParse((await context.params).slug);
  const query = providerQuery.safeParse(queryObject(new URL(request.url).searchParams));
  if (!param.success || !query.success) return apiError(400);
  try {
    const data = await findProvider(param.data, query.data);
    return data ? Response.json({ data }) : apiError(404);
  } catch {
    return apiError(503);
  }
}
