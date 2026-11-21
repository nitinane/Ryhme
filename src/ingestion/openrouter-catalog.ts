import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";

export const catalogUrl = "https://openrouter.ai/api/v1/models?output_modalities=all";
const homepage = "https://openrouter.ai/";
export const openRouterSourceId = "openrouter";
const sourceId = openRouterSourceId;
const modelId = z.string().max(180).regex(/^[a-z0-9-]+\/[a-z0-9][a-z0-9_.-]*(?::[a-z0-9-]+)?$/);
const listing = z.object({
  id: modelId,
  canonical_slug: modelId.nullish(),
  name: z.string().trim().min(1).max(240),
  context_length: z.number().int().positive().max(2_147_483_647).nullish().catch(null),
  architecture: z.object({
    input_modalities: z.array(z.string().max(30)).max(20).nullish(),
    output_modalities: z.array(z.string().max(30)).max(20).nullish(),
  }).nullish().catch(null),
  supported_parameters: z.array(z.string().max(80)).max(100).nullish().catch(null),
  pricing: z.object({ prompt: z.unknown().optional(), completion: z.unknown().optional() }).nullish().catch(null),
});
const responseSchema = z.object({
  data: z.array(z.unknown()).max(1_000),
  total_count: z.number().int().min(1).max(10_000),
});

export function perMillion(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,12}(?:\.\d{1,24})?$/.test(value)) return null;
  const amount = new Prisma.Decimal(value).times(1_000_000).toDecimalPlaces(8);
  return amount.gte("10000000000") || (amount.isZero() && !new Prisma.Decimal(value).isZero()) ? null : amount;
}

async function fetchPage(url: string, fetcher: typeof fetch, wait: (milliseconds: number) => Promise<unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetcher(url, {
      redirect: "error", signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (response?.ok) return responseSchema.parse(await response.json());
    const status = response?.status;
    if (attempt === 2 || (status && status !== 429 && status < 500)) {
      throw new Error(status ? `OpenRouter catalog request failed (HTTP ${status}).` : "OpenRouter catalog request timed out or could not connect.");
    }
    const retryAfter = response?.headers.get("Retry-After");
    const retryMs = retryAfter == null ? 0 : /^\d+$/.test(retryAfter)
      ? Number(retryAfter) * 1_000 : Date.parse(retryAfter) - Date.now();
    if (retryMs > 30_000 || (status === 429 && retryAfter != null && !Number.isFinite(retryMs))) {
      throw new Error("OpenRouter requested a retry outside this run's wait budget.");
    }
    await response?.body?.cancel();
    await wait(Math.max(retryMs || 0, 500 * 2 ** attempt));
  }
  throw new Error("OpenRouter retry budget exhausted.");
}

export async function fetchCatalog(fetcher = fetch, wait = delay) {
  const rows: unknown[] = [];
  let total: number | undefined;
  for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
    const page = await fetchPage(`${catalogUrl}&limit=1000&offset=${rows.length}`, fetcher, wait);
    total ??= page.total_count;
    if (page.total_count !== total || !page.data.length || rows.length + page.data.length > total) {
      throw new Error("OpenRouter catalog changed during pagination. Run a fresh preview.");
    }
    rows.push(...page.data);
    if (rows.length === total) return rows;
  }
  throw new Error("OpenRouter catalog exceeded this run's page budget.");
}

const labNames: Record<string, string> = {
  openai: "OpenAI", google: "Google DeepMind", anthropic: "Anthropic", "meta-llama": "Meta",
  qwen: "Qwen", deepseek: "DeepSeek", mistralai: "Mistral AI", "x-ai": "xAI",
};
const families: Record<string, Record<string, string>> = {
  openai: { "gpt-4.1": "GPT-4.1", "gpt-4o": "GPT-4o", "gpt-5": "GPT-5", o3: "o3", o4: "o4" },
  google: { "gemini-2.5": "Gemini 2.5", "gemini-3": "Gemini 3", "gemma-3": "Gemma 3", "gemma-4": "Gemma 4" },
  anthropic: { claude: "Claude" }, mistralai: { mistral: "Mistral", pixtral: "Pixtral", codestral: "Codestral" }, "meta-llama": { llama: "Llama" },
  qwen: { qwen3: "Qwen3", "qwen2.5": "Qwen2.5" }, deepseek: { "deepseek-r1": "DeepSeek R1", "deepseek-v3": "DeepSeek V3" },
  "x-ai": { grok: "Grok" },
};
const reviewedModels: Record<string, string> = {
  "openai/gpt-4.1-2025-04-14": "gpt-4-1-2025-04-14",
  "openai/gpt-4.1-mini-2025-04-14": "gpt-4-1-mini-2025-04-14",
  "openai/gpt-4.1-nano-2025-04-14": "gpt-4-1-nano-2025-04-14",
  "google/gemma-3-27b-it": "gemma-3-27b-it",
};

export function stableSlug(value: string) {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `or-${value.replace(/[^a-z0-9]+/g, "-").slice(0, 95).replace(/-+$/, "")}-${hash}`;
}

function prepare(row: z.infer<typeof listing>) {
  const canonical = (row.canonical_slug ?? row.id).split(":")[0];
  const [author, model] = canonical.split("/");
  if (author !== row.id.split("/")[0] || author === "openrouter") return null;
  const family = Object.entries(Object.hasOwn(families, author) ? families[author] : {}).find(([prefix]) =>
    model === prefix || model.startsWith(`${prefix}-`) || model.startsWith(`${prefix}.`));
  const labName = Object.hasOwn(labNames, author) ? labNames[author] : undefined;
  const labSlug = author === "google" ? "google-deepmind" : labName ? author : stableSlug(`namespace/${author}`);
  const input = row.architecture?.input_modalities;
  const output = row.architecture?.output_modalities;
  const params = row.supported_parameters;
  const plain = !row.id.includes(":");
  const canonicalOnly = canonical === row.id;
  return {
    key: canonical, externalModelId: row.id, plain, canonicalOnly,
    reviewedSlug: reviewedModels[canonical],
    labSlug, labName: labName ?? `${author} (OpenRouter namespace)`,
    familySlug: family?.[1] === "GPT-4.1" ? "gpt-4-1" : family?.[1] === "Gemma 3" ? "gemma-3"
      : stableSlug(`${author}/${family?.[0] ?? model}`),
    familyName: family?.[1] ?? model,
    slug: stableSlug(canonical),
    name: row.name, context: row.context_length ?? null,
    modalities: input?.length || output?.length
      ? { ...(input?.length ? { input } : {}), ...(output?.length ? { output } : {}) } : undefined,
    capabilities: params ? [
      ...(params.includes("tools") ? ["tool-calling"] : []),
      ...(params.includes("structured_outputs") ? ["structured-outputs"] : []),
    ] : undefined,
    inputPrice: input?.includes("text") && output?.includes("text") ? perMillion(row.pricing?.prompt) : null,
    outputPrice: output?.includes("text") ? perMillion(row.pricing?.completion) : null,
  };
}

export function normalizeCatalog(raw: unknown[]) {
  const rows = new Map<string, NonNullable<ReturnType<typeof prepare>>>();
  const seen = new Set<string>();
  let rejected = 0;
  let duplicateIds = 0;
  for (const entry of raw) {
    const parsed = listing.safeParse(entry);
    const row = parsed.success ? prepare(parsed.data) : null;
    if (!row) { rejected++; continue; }
    if (seen.has(row.externalModelId)) {
      rows.delete(row.externalModelId);
      duplicateIds++;
      continue;
    }
    seen.add(row.externalModelId);
    rows.set(row.externalModelId, row);
  }
  return {
    discovered: raw.length, rejected, duplicateIds,
    seenIds: [...new Set(raw.flatMap((entry) => {
      const parsed = z.object({ id: modelId }).safeParse(entry);
      return parsed.success ? [parsed.data.id] : [];
    }))],
    rows: [...rows.values()].sort((a, b) => Number(b.plain) - Number(a.plain)
      || Number(b.canonicalOnly) - Number(a.canonicalOnly) || a.externalModelId.localeCompare(b.externalModelId)),
  };
}

type CatalogRow = ReturnType<typeof normalizeCatalog>["rows"][number];

export async function catalogPlan(tx: Prisma.TransactionClient, rows: CatalogRow[], observedAt: Date, live = false) {
  const [labs, families, models, offers, provider, source] = await Promise.all([
    tx.lab.findMany({ where: { slug: { in: rows.map((row) => row.labSlug) } }, select: { slug: true } }),
    tx.modelFamily.findMany({ where: { slug: { in: rows.map((row) => row.familySlug) } }, select: { slug: true, lab: { select: { slug: true } } } }),
    tx.modelVersion.findMany({ where: { slug: { in: rows.flatMap((row) => [row.slug, ...(row.reviewedSlug ? [row.reviewedSlug] : [])]) } },
      select: { slug: true, family: { select: { slug: true } }, canonicalName: true, contextTokens: true, modalities: true, capabilities: true } }),
    tx.offering.findMany({ where: { provider: { slug: "openrouter" }, externalModelId: { in: rows.map((row) => row.externalModelId) } },
      select: { externalModelId: true, sourceId: true, sourceUrl: true, observedAt: true, availabilityStatus: true, model: { select: { slug: true } },
        prices: { where: { sourceId, currency: "USD", ...(live ? {} : { observedAt: { gte: observedAt } }) },
          orderBy: [{ observedAt: "desc" }, { id: "desc" }], select: { observedAt: true, inputPerMillion: true, outputPerMillion: true }, take: 1 } } }),
    tx.provider.findUnique({ where: { slug: "openrouter" }, select: { id: true } }),
    tx.dataSource.findUnique({ where: { id: sourceId }, select: { id: true } }),
  ]);
  const knownLabs = new Set(labs.map(({ slug }) => slug));
  const knownFamilies = new Map(families.map((family) => [family.slug, family.lab.slug]));
  const existingModels = new Map(models.map((model) => [model.slug, model]));
  const knownModels = new Map(models.map((model) => [model.slug, model.family.slug]));
  const processedModels = new Set<string>();
  const knownOffers = new Map(offers.map((offer) => [offer.externalModelId, offer]));
  const stats = { providers: Number(!provider), sources: Number(!source), labs: 0, families: 0, models: 0,
    offerings: 0, refreshes: 0, metadataUpdates: 0, restored: 0, observations: 0, prices: 0, conflicts: 0, unknownPrices: 0, unpricedListings: 0 };
  const actions = rows.flatMap((row) => {
    const reviewed = row.reviewedSlug && knownModels.has(row.reviewedSlug) ? row.reviewedSlug : undefined;
    const slug = reviewed ?? row.slug;
    const offer = knownOffers.get(row.externalModelId);
    const familyLab = knownFamilies.get(row.familySlug);
    const modelFamily = knownModels.get(slug);
    if ((offer && offer.model.slug !== slug) || (!reviewed && modelFamily && modelFamily !== row.familySlug)
      || (familyLab && familyLab !== row.labSlug)) {
      stats.conflicts++;
      return [];
    }
    const managed = offer?.sourceUrl === catalogUrl;
    if (offer && (offer.sourceId !== sourceId || (!managed || !live) && offer.availabilityStatus !== "LISTED"
      || offer.observedAt > observedAt)) return [];
    const insertModel = !knownModels.has(slug);
    if (insertModel) {
      if (!knownLabs.has(row.labSlug)) { knownLabs.add(row.labSlug); stats.labs++; }
      if (!knownFamilies.has(row.familySlug)) { knownFamilies.set(row.familySlug, row.labSlug); stats.families++; }
      knownModels.set(slug, row.familySlug);
      stats.models++;
      stats.observations++;
    }
    if (!offer) stats.offerings++;
    const refreshOffer = !!offer && offer.observedAt < observedAt && (!live || managed);
    if (refreshOffer) stats.refreshes++;
    if (refreshOffer && offer?.availabilityStatus !== "LISTED") stats.restored++;
    const oldModel = existingModels.get(slug);
    let metadata: Prisma.ModelVersionUpdateInput | undefined;
    if (live && !reviewed && oldModel && row.plain && !processedModels.has(slug)) {
      const previous = oldModel.modalities && typeof oldModel.modalities === "object" && !Array.isArray(oldModel.modalities)
        ? oldModel.modalities : {};
      const merged = row.modalities ? { ...previous, ...row.modalities } : undefined;
      metadata = {
        ...(row.name !== oldModel.canonicalName ? { canonicalName: row.name } : {}),
        ...(row.context !== null && row.context !== oldModel.contextTokens ? { contextTokens: row.context } : {}),
        ...(merged && (Object.keys(merged).some((key) => JSON.stringify(merged[key as keyof typeof merged]) !== JSON.stringify(previous[key])))
          ? { modalities: merged } : {}),
        ...(row.capabilities?.length && JSON.stringify(row.capabilities) !== JSON.stringify(oldModel.capabilities)
          ? { capabilities: row.capabilities } : {}),
      };
      if (!Object.keys(metadata).length) metadata = undefined;
      else stats.metadataUpdates++;
    }
    processedModels.add(slug);
    const prior = offer?.prices[0];
    const inputPrice = row.inputPrice ?? (live ? prior?.inputPerMillion ?? null : null);
    const outputPrice = row.outputPrice ?? (live ? prior?.outputPerMillion ?? null : null);
    const hasPrice = row.inputPrice !== null || row.outputPrice !== null;
    const insertPrice = hasPrice && (!prior || (live && prior.observedAt < observedAt
      && (inputPrice?.toString() !== prior.inputPerMillion?.toString()
        || outputPrice?.toString() !== prior.outputPerMillion?.toString())));
    if (insertPrice) stats.prices++;
    if (row.inputPrice === null || row.outputPrice === null) stats.unknownPrices++;
    if (row.inputPrice === null && row.outputPrice === null) stats.unpricedListings++;
    return [{ row, slug, insertModel, insertPrice, inputPrice, outputPrice, insertOffer: !offer, refreshOffer, metadata }];
  });
  return { stats, actions };
}

export async function syncCatalog(tx: Prisma.TransactionClient, plan: Awaited<ReturnType<typeof catalogPlan>>, observedAt: Date, live = false) {
  await tx.dataSource.upsert({ where: { id: sourceId }, update: {}, create: {
    id: sourceId, name: "OpenRouter", homepage, sourceType: "OFFICIAL",
    trustPolicy: "Gateway catalog listings and advertised token prices. Does not establish model release date, lifecycle, or benchmark performance.",
  } });
  const provider = await tx.provider.upsert({ where: { slug: "openrouter" }, update: {}, create: {
    slug: "openrouter", name: "OpenRouter", website: homepage,
  } });
  const newModels = plan.actions.filter(({ insertModel }) => insertModel);
  const labs = new Map(newModels.map(({ row }) => [row.labSlug, { slug: row.labSlug, name: row.labName }]));
  await tx.lab.createMany({ data: [...labs.values()], skipDuplicates: true });
  const labIds = new Map((await tx.lab.findMany({
    where: { slug: { in: [...labs.keys()] } }, select: { slug: true, id: true },
  })).map(({ slug, id }) => [slug, id]));
  const families = new Map(newModels.map(({ row }) => [row.familySlug, {
    slug: row.familySlug, name: row.familyName, labId: labIds.get(row.labSlug)!,
  }]));
  await tx.modelFamily.createMany({ data: [...families.values()], skipDuplicates: true });
  const familyIds = new Map((await tx.modelFamily.findMany({
    where: { slug: { in: [...families.keys()] } }, select: { slug: true, id: true },
  })).map(({ slug, id }) => [slug, id]));
  await tx.modelVersion.createMany({ data: newModels.map(({ row, slug }) => ({
    slug, canonicalName: row.plain ? row.name : row.key, familyId: familyIds.get(row.familySlug)!,
    contextTokens: row.context, modalities: row.modalities, capabilities: row.capabilities,
  })) });
  for (const { slug, metadata } of plan.actions) {
    if (metadata) await tx.modelVersion.update({ where: { slug }, data: metadata });
  }
  const modelIds = new Map((await tx.modelVersion.findMany({
    where: { slug: { in: [...new Set(plan.actions.map(({ slug }) => slug))] } }, select: { slug: true, id: true },
  })).map(({ slug, id }) => [slug, id]));
  await tx.sourceObservation.createMany({ data: newModels.map(({ slug }) => ({
    sourceId, entityType: "ModelVersion", entityId: modelIds.get(slug)!, field: "gateway catalog metadata",
    sourceUrl: catalogUrl, observedAt, verificationStatus: "VERIFIED",
  })) });
  await tx.offering.createMany({ data: plan.actions.filter(({ insertOffer }) => insertOffer).map(({ row, slug }) => ({
    providerId: provider.id, externalModelId: row.externalModelId, modelVersionId: modelIds.get(slug)!,
    sourceId, sourceUrl: catalogUrl, contextOverride: row.context, availabilityStatus: "LISTED", observedAt,
  })) });
  const refresh = plan.actions.filter(({ refreshOffer }) => refreshOffer).map(({ row }) => row);
  if (refresh.length) await tx.$executeRaw`
    UPDATE "Offering" AS o
    SET "observedAt" = ${observedAt}, "catalogMissingSince" = NULL, "availabilityStatus" = 'LISTED', "contextOverride" = COALESCE(v.context, o."contextOverride")
    FROM (VALUES ${Prisma.join(refresh.map((row) => Prisma.sql`(${row.externalModelId}, ${row.context}::integer)`))}) AS v(external, context)
    WHERE o."providerId" = ${provider.id} AND o."externalModelId" = v.external
      AND o."sourceId" = ${sourceId} AND o."observedAt" < ${observedAt}
      ${live ? Prisma.sql`AND o."sourceUrl" = ${catalogUrl}` : Prisma.sql`AND o."availabilityStatus" = 'LISTED'`}
  `;
  const priced = plan.actions.filter(({ insertPrice }) => insertPrice);
  const offerIds = new Map((await tx.offering.findMany({
    where: { providerId: provider.id, externalModelId: { in: priced.map(({ row }) => row.externalModelId) } },
    select: { externalModelId: true, id: true },
  })).map(({ externalModelId, id }) => [externalModelId, id]));
  await tx.priceObservation.createMany({ data: priced.map(({ row, inputPrice, outputPrice }) => ({
    offeringId: offerIds.get(row.externalModelId)!, sourceId, sourceUrl: catalogUrl, currency: "USD", observedAt,
    inputPerMillion: inputPrice, outputPerMillion: outputPrice,
  })) });
}
