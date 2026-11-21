import { slug } from "@/features/catalog/schemas/query";
import { findLab } from "@/features/ecosystem/service";
import { apiError } from "@/lib/http/errors";

export async function GET(request: Request, context: RouteContext<"/api/labs/[slug]">) {
  const param = slug.safeParse((await context.params).slug);
  if (!param.success || new URL(request.url).search) return apiError(400);
  try {
    const data = await findLab(param.data);
    return data ? Response.json({ data }) : apiError(404);
  } catch {
    return apiError(503);
  }
}
