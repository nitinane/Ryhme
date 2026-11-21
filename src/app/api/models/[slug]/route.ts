import { slug } from "@/features/catalog/schemas/query";
import { findModel } from "@/features/catalog/services/models";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request, context: RouteContext<"/api/models/[slug]">) {
  const params = slug.safeParse((await context.params).slug);
  if (!params.success || new URL(request.url).search) return apiError(400);
  try {
    const data = await findModel(params.data);
    return data ? Response.json({ data }) : apiError(404);
  } catch {
    return apiError(503);
  }
}
