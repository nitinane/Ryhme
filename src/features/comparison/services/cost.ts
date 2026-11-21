import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { offeringInclude } from "@/features/catalog/services/models";
import { costRequest } from "../schemas/compare";
import { estimateCost } from "../cost";

export async function estimateOfferings({ offeringIds, inputTokens, outputTokens }: z.infer<typeof costRequest>) {
  const offerings = await getDb().offering.findMany({ where: { id: { in: offeringIds } }, include: offeringInclude });
  if (offerings.length !== offeringIds.length) return null;
  const byId = new Map(offerings.map((offering) => [offering.id, offering]));
  return offeringIds.map((offeringId) => {
    const offering = byId.get(offeringId)!;
    const price = offering.prices[0] ?? null;
    const amount = estimateCost(price, inputTokens, outputTokens);
    return {
      offeringId,
      provider: offering.provider.name,
      availabilityStatus: offering.availabilityStatus,
      amount,
      currency: price?.currency ?? null,
      observedAt: price?.observedAt ?? null,
      sourceUrl: price?.sourceUrl ?? null,
      historical: price !== null,
      reason: amount === null ? "PRICE_UNKNOWN" as const : null,
    };
  });
}
