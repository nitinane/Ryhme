import { catalogCount } from "@/features/catalog/services/count";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await catalogCount();
  const headers = { "Cache-Control": "no-store" };
  if (count === null) {
    return Response.json(
      { data: null, error: { code: "SERVICE_UNAVAILABLE", message: "Catalog temporarily unavailable." } },
      { status: 503, headers },
    );
  }
  return Response.json({ data: { status: "ok" } }, { headers });
}
