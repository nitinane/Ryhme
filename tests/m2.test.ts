import { describe, expect, it, vi } from "vitest";
import { rankingQuery, scoreDirection } from "../src/features/benchmarks/query";
import { labQuery, providerQuery } from "../src/features/ecosystem/query";
import { observeOpenRouter } from "../src/ingestion/openrouter";

it("validates ranking and ecosystem URL filter bounds", () => {
  expect(rankingQuery.parse({ category: "mathematics", sort: "worst", limit: "2" }))
    .toMatchObject({ category: "mathematics", sort: "worst", limit: 2, page: 1 });
  expect(rankingQuery.safeParse({ sort: "composite" }).success).toBe(false);
  expect(rankingQuery.safeParse({ page: ["1", "2"] }).success).toBe(false);
  expect(providerQuery.safeParse({ availability: "UNAVAILABLE", capability: "tool-calling" }).success).toBe(true);
  expect(providerQuery.safeParse({ q: "x".repeat(121), availability: "ONLINE" }).success).toBe(false);
  expect(labQuery.safeParse({ limit: "101" }).success).toBe(false);
});

it("uses each benchmark's scoring direction", () => {
  expect(scoreDirection("LOWER")).toBe("ASC");
  expect(scoreDirection("HIGHER")).toBe("DESC");
});

describe("OpenRouter listing verification", () => {
  const expected = "google/gemma-3-27b-it";

  it("requires one exact model listing and uses a bounded unauthenticated call", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      data: { id: expected, endpoints: [{ model_id: expected }] },
    }));
    const observed = await observeOpenRouter(fetcher);
    expect(observed.getUTCHours()).toBe(0);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      `https://openrouter.ai/api/v1/models/${expected}/endpoints`,
      { redirect: "error", signal: expect.any(AbortSignal) },
    );
  });

  it("rejects rate limits, incomplete listings, and mismatched model aliases", async () => {
    const rateLimited = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 }));
    await expect(observeOpenRouter(rateLimited)).rejects.toThrow("HTTP 429");
    expect(rateLimited).toHaveBeenCalledTimes(1);
    for (const data of [
      { id: expected, endpoints: [] },
      { id: expected, endpoints: [{ model_id: `${expected}:free` }] },
      { id: `${expected}:free`, endpoints: [{ model_id: expected }] },
    ]) {
      await expect(observeOpenRouter(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data })))).rejects.toThrow("did not confirm");
    }
  });
});
