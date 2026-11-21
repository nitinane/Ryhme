import { costRequest } from "@/features/comparison/schemas/compare";
import { estimateOfferings } from "@/features/comparison/services/cost";
import { apiError } from "@/lib/http/errors";

async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return null;
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
    || new URL(request.url).search) return apiError(400);
  const input = costRequest.safeParse(await boundedJson(request));
  if (!input.success) return apiError(400);
  try {
    const data = await estimateOfferings(input.data);
    return data ? Response.json({ data }) : apiError(404);
  } catch {
    return apiError(503);
  }
}
