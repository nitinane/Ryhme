import { describe, expect, it, vi } from "vitest";
import { fetchCatalog, normalizeCatalog, perMillion } from "../src/ingestion/openrouter-catalog";

const item = {
  id: "maker/model",
  canonical_slug: "maker/model-20261121",
  name: "Model",
  context_length: 128_000,
  pricing: { prompt: "0.0000025", completion: "0.000006" },
  architecture: { input_modalities: ["image", "text"], output_modalities: ["text"] },
  supported_parameters: ["tools", "structured_outputs"],
};

describe("OpenRouter catalog normalization", () => {
  it("converts USD per token precisely and keeps missing or dynamic values unknown", () => {
    expect(perMillion("0.00000250000001")?.toString()).toBe("2.50000001");
    expect(perMillion("0")?.toString()).toBe("0");
    for (const value of [null, undefined, "-1", 0, "1e-6", "0.00000000000000001", "10000"]) {
      expect(perMillion(value)).toBeNull();
    }
  });

  it("deduplicates checkpoints without merging distinct identifiers or tariff variants", () => {
    const result = normalizeCatalog([
      { ...item, id: "maker/model:free", pricing: { prompt: "0", completion: "0" } },
      item,
      { ...item, id: "maker/model.v2", canonical_slug: "maker/model.v2" },
      { ...item, id: "maker/model-v2", canonical_slug: "maker/model-v2" },
      { ...item, id: "openrouter/auto", canonical_slug: "openrouter/auto" },
    ]);
    const [first, second, third, fourth] = result.rows;
    expect(first.slug).not.toBe(second.slug);
    expect(third.slug).toBe(fourth.slug);
    expect(third.externalModelId).toBe(item.id);
    expect(fourth.inputPrice?.toString()).toBe("0");
    expect(result.rejected).toBe(1);
    expect(normalizeCatalog([item, { ...item, canonical_slug: "maker/conflict" }])).toMatchObject({ duplicateIds: 1, rows: [] });
  });

  it("keeps non-token and missing fields unknown", () => {
    const [image, missing] = normalizeCatalog([
      { ...item, id: "maker/image", canonical_slug: "maker/image",
        architecture: { input_modalities: ["text"], output_modalities: ["image"] } },
      { ...item, id: "maker/missing", canonical_slug: "maker/missing", pricing: null, architecture: null, context_length: 0 },
    ]).rows;
    expect(image.inputPrice).toBeNull();
    expect(image.outputPrice).toBeNull();
    expect(missing).toMatchObject({ context: null, inputPrice: null, outputPrice: null });
  });
});

describe("OpenRouter catalog retrieval", () => {
  it("honors retry-after and follows bounded offsets", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(Response.json({ data: [item], total_count: 2 }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: "maker/second" }], total_count: 2 }));
    const wait = vi.fn().mockResolvedValue(undefined);
    expect(await fetchCatalog(fetcher, wait)).toHaveLength(2);
    expect(wait).toHaveBeenCalledWith(2_000);
    expect(fetcher.mock.calls[2][0]).toContain("offset=1");
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("stops on permanent failures, long rate-limit waits and inconsistent snapshots", async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(fetchCatalog(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })), wait)).rejects.toThrow("HTTP 403");
    await expect(fetchCatalog(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "120" } })), wait)).rejects.toThrow("wait budget");
    const changing = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ data: [item], total_count: 2 }))
      .mockResolvedValueOnce(Response.json({ data: [item], total_count: 3 }));
    await expect(fetchCatalog(changing, wait)).rejects.toThrow("changed during pagination");
    expect(wait).not.toHaveBeenCalled();
    const network = vi.fn<typeof fetch>().mockRejectedValue(new Error("unavailable"));
    await expect(fetchCatalog(network, wait)).rejects.toThrow("could not connect");
    expect(network).toHaveBeenCalledTimes(3);
  });
});
