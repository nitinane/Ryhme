import type { Prisma } from "../src/generated/prisma/client";
import { gemmaSlug, saveOpenRouterListing } from "../src/ingestion/openrouter";

const modelCard = "https://huggingface.co/google/gemma-3-27b-it";
const announcement = "https://blog.google/innovation-and-ai/technology/developers-tools/gemma-3/";
const terms = "https://ai.google.dev/gemma/terms";
const releaseDate = new Date("2025-03-12");
const observedAt = new Date("2026-11-21");

export async function seedGemma(tx: Prisma.TransactionClient) {
  const sourceId = "google-deepmind";
  const website = "https://deepmind.google/";
  await tx.dataSource.upsert({
    where: { id: sourceId }, update: {},
    create: { id: sourceId, name: "Google DeepMind", homepage: website, sourceType: "OFFICIAL",
      trustPolicy: "Publisher announcement and Google DeepMind model card hosted by Hugging Face." },
  });
  const lab = await tx.lab.upsert({
    where: { slug: sourceId }, update: {}, create: { slug: sourceId, name: "Google DeepMind", website },
  });
  const family = await tx.modelFamily.upsert({
    where: { slug: "gemma-3" }, update: {}, create: { slug: "gemma-3", labId: lab.id, name: "Gemma 3" },
  });
  const model = await tx.modelVersion.upsert({
    where: { slug: gemmaSlug }, update: {},
    create: {
      slug: gemmaSlug, familyId: family.id, canonicalName: "Gemma 3 27B Instruct", releaseDate,
      contextTokens: 131_072, modalities: { input: ["text", "image"], output: ["text"] },
      capabilities: ["tool-calling", "structured-outputs"], license: "Gemma Terms of Use", openWeights: true,
    },
  });
  const facts = [
    { entityType: "Lab", entityId: lab.id, field: "identity", sourceUrl: modelCard },
    { entityType: "ModelFamily", entityId: family.id, field: "identity", sourceUrl: announcement },
    ...[
      ["canonicalName", modelCard], ["releaseDate", announcement], ["contextTokens", modelCard],
      ["modalities", modelCard], ["openWeights", modelCard], ["license", terms], ["capabilities", announcement],
    ].map(([field, sourceUrl]) => ({ entityType: "ModelVersion", entityId: model.id, field, sourceUrl })),
  ];
  await tx.sourceObservation.createMany({
    data: facts.map((fact) => ({ ...fact, sourceId, observedAt, verificationStatus: "VERIFIED" })),
    skipDuplicates: true,
  });
  await saveOpenRouterListing(tx, observedAt);
}
