import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";

export const gemmaSlug = "gemma-3-27b-it";
const externalModelId = "google/gemma-3-27b-it";
const url = `https://openrouter.ai/api/v1/models/${externalModelId}/endpoints`;
const listing = z.object({
  data: z.object({
    id: z.literal(externalModelId),
    endpoints: z.array(z.object({ model_id: z.string() })).min(1).max(100),
  }),
}).refine(({ data }) => data.endpoints.some((row) => row.model_id === data.id));

export async function observeOpenRouter(fetcher: typeof fetch = fetch) {
  const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`OpenRouter metadata request failed (HTTP ${response.status}).`);
  const metadata = listing.safeParse(await response.json());
  if (!metadata.success) throw new Error("OpenRouter did not confirm the selected offering.");
  return new Date(new Date().toISOString().slice(0, 10));
}

export async function saveOpenRouterListing(tx: Prisma.TransactionClient, observedAt: Date) {
  const model = await tx.modelVersion.findUniqueOrThrow({ where: { slug: gemmaSlug }, select: { id: true } });
  const sourceId = "openrouter";
  const homepage = "https://openrouter.ai/";
  await tx.dataSource.upsert({
    where: { id: sourceId }, update: {},
    create: { id: sourceId, name: "OpenRouter", homepage, sourceType: "OFFICIAL",
      trustPolicy: "Exact model endpoint listing only. Gateway routes, prices, and availability may vary." },
  });
  const provider = await tx.provider.upsert({
    where: { slug: "openrouter" }, update: {},
    create: { slug: "openrouter", name: "OpenRouter", website: homepage },
  });
  const key = { providerId: provider.id, externalModelId };
  await tx.offering.upsert({
    where: { providerId_externalModelId: key }, update: {},
    create: { ...key, modelVersionId: model.id, sourceId, sourceUrl: url, availabilityStatus: "LISTED", observedAt },
  });
  await tx.offering.updateMany({
    where: { ...key, sourceId, modelVersionId: model.id, availabilityStatus: "LISTED", observedAt: { lt: observedAt } },
    data: { observedAt },
  });
  await tx.sourceObservation.createMany({
    data: { sourceId, entityType: "Provider", entityId: provider.id, field: "identity",
      sourceUrl: url, observedAt, verificationStatus: "VERIFIED" },
    skipDuplicates: true,
  });
}
