import { describe, expect, it } from "vitest";
import { safeSource } from "../src/features/catalog/presentation";
import { catalogQuery, queryObject } from "../src/features/catalog/schemas/query";
import { estimateCost } from "../src/features/comparison/cost";
import { compareApiQuery, compareQuery, costRequest, tokenLimit } from "../src/features/comparison/schemas/compare";

describe("catalog query", () => {
  it("normalizes input and preserves meaningful zero filters", () => {
    const input = catalogQuery.parse({ q: "  GPT-4.1 ", minContext: "0", maxInputPrice: "0", provider: "",
      lifecycle: "RETIRED", capability: "tool-calling", openWeights: "false" });
    expect(input).toMatchObject({ q: "GPT-4.1", minContext: 0, maxInputPrice: "0", lifecycle: "RETIRED",
      capability: "tool-calling", openWeights: false, page: 1, limit: 20, sort: "name" });
    expect(input.provider).toBeUndefined();
  });

  it("rejects repeat, unknown, unbounded and malformed parameters", () => {
    expect(catalogQuery.safeParse(queryObject(new URLSearchParams("page=1&page=2"))).success).toBe(false);
    for (const input of [{ unexpected: "1" }, { limit: "101" }, { page: "10001" }, { maxInputPrice: "1e4" },
      { minContext: "2147483648" }, { capability: "invented" }, { q: "a".repeat(121) }]) {
      expect(catalogQuery.safeParse(input).success).toBe(false);
    }
  });

  it("allows HTTPS source links and does not render unsafe protocols or embedded credentials", () => {
    expect(safeSource("https://openai.com/index/gpt-4-1/")).toBe("https://openai.com/index/gpt-4-1/");
    expect(safeSource("javascript:alert(1)")).toBeNull();
    expect(safeSource("https://user:password@example.com")).toBeNull();
  });
});

describe("comparison and cost", () => {
  it("keeps selection order and accepts two through four unique IDs", () => {
    expect(compareQuery.parse({ models: "second,first" }).models).toEqual(["second", "first"]);
    expect(compareApiQuery.safeParse({ modelId: ["a", "b", "c", "d"] }).success).toBe(true);
    for (const models of ["a", "a,a", "a,,b", "a,b,c,d,e", "a,b<script>"]) {
      expect(compareQuery.safeParse({ models }).success).toBe(false);
    }
  });

  it("validates token budgets and rejects duplicate or malformed offering requests", () => {
    expect(costRequest.safeParse({ offeringIds: ["first"], inputTokens: 0, outputTokens: tokenLimit }).success).toBe(true);
    for (const input of [{ inputTokens: -1 }, { inputTokens: "0" }, { outputTokens: 1.1 },
      { outputTokens: tokenLimit + 1 }, { offeringIds: ["first", "first"] }, { offeringIds: [] }]) {
      expect(costRequest.safeParse({ offeringIds: ["first"], inputTokens: 0, outputTokens: 0, ...input }).success).toBe(false);
    }
  });

  it("calculates large, tiny and zero estimates exactly and preserves unknown prices", () => {
    const rate = (value: string) => ({ toFixed: () => value });
    const prices = { inputPerMillion: rate("0.40000000"), outputPerMillion: rate("1.60000000") };
    expect(estimateCost(prices, 1_000_000, 100_000)).toBe("0.56");
    expect(estimateCost(prices, 0, 0)).toBe("0.00");
    expect(estimateCost(prices, tokenLimit, tokenLimit)).toBe("2000000.00");
    expect(estimateCost(prices, 1, 1)).toBe("0.000002");
    expect(estimateCost({ ...prices, inputPerMillion: rate("0.00000001") }, 1, 0)).toBe("0.00000000000001");
    expect(estimateCost({ ...prices, inputPerMillion: null }, 0, 0)).toBeNull();
    expect(estimateCost(null, 0, 0)).toBeNull();
  });
});
