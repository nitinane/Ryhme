import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]{0,179}$/);
const count = z.number().int().positive().max(2_147_483_647).nullish();
const label = z.string().trim().min(1).max(240);
const timestamp = z.string().datetime({ offset: true }).nullish();
const snapshotId = /-\d{4}-\d{2}-\d{2}$|-\d{8}$/;
const modalities = z.array(z.enum(["Text", "Image", "Audio", "Video"]));
const price = z.object({ type: z.string(), price: z.string().regex(/^\d{1,9}(?:\.\d{1,8})?$/),
  price_unit: z.string(), time_band: z.string().optional() });
const modelList = z.object({ data: z.array(z.object({ id: label })) });

export type CatalogModel = {
  id: string; revision: string; name: string; family?: string; releaseDate?: string;
  contextTokens?: number; inputLimit?: number; outputLimit?: number;
  modalities?: { input: string[]; output: string[] }; capabilities?: string[];
  lifecycle?: "ACTIVE" | "DEPRECATED" | "RETIRED"; license?: string; url?: string;
  price?: { currency: string; input: string; output: string };
};

type FeedRow = CatalogModel | { id: string; target?: string };
type Page = { rows: FeedRow[]; next?: URL; total?: number };
export type CatalogAdapter = {
  source: string; name: string; homepage: string; provider?: string;
  lab: { slug: string; name: string; website: string }; routerNamespace?: string;
  start: URL; headers?: Record<string, string>;
  parse: (payload: unknown, url: URL, headers: Headers) => Page;
};

export async function fetchCatalogSnapshot(adapter: CatalogAdapter, etag?: string | null, fetcher = fetch, wait: (ms: number) => Promise<unknown> = delay) {
  let next: URL | undefined = adapter.start;
  const rows: FeedRow[] = [];
  const ids = new Set<string>();
  let total: number | undefined;
  let validator: string | null = null;
  for (let page = 0; next && page < 20; page++) {
    if (next.origin !== adapter.start.origin || next.pathname !== adapter.start.pathname || next.username || next.password) {
      throw new Error("Unexpected catalog pagination URL.");
    }
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetcher(next, {
        headers: { ...adapter.headers, ...(!page && etag ? { "If-None-Match": etag } : {}) },
        redirect: "error", signal: AbortSignal.timeout(8_000),
      }).catch(() => undefined);
      if (response?.ok || response?.status === 304) break;
      if (response && response.status !== 429 && response.status < 500) break;
      const retry = response?.headers.get("Retry-After");
      const retryMs = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 250 * 2 ** attempt;
      await response?.body?.cancel();
      if (attempt < 2 && Number.isFinite(retryMs) && retryMs <= 10_000) await wait(Math.max(0, retryMs));
      else break;
    }
    if (response?.status === 304 && !page && etag) return { unchanged: true } as const;
    if (!response?.ok) throw new Error(`Catalog fetch failed (${response?.status ?? "unavailable"}).`);
    const parsed = adapter.parse(await response.json(), next, response.headers);
    validator = !page && !parsed.next ? response.headers.get("ETag") : null;
    total ??= parsed.total;
    if ((parsed.total !== undefined && parsed.total !== total) || (parsed.next && !parsed.rows.length)) {
      throw new Error("Catalog changed during pagination.");
    }
    for (const row of parsed.rows) {
      if (ids.has(row.id)) throw new Error("Duplicate source model identifier.");
      ids.add(row.id);
      rows.push(row);
    }
    next = parsed.next;
  }
  if (next || !rows.length || (total !== undefined && rows.length !== total)) throw new Error("Incomplete catalog snapshot.");
  return { rows: rows.sort((a, b) => a.id.localeCompare(b.id)), etag: validator };
}

const openai = { slug: "openai", name: "OpenAI", website: "https://openai.com/" };
const anthropic = { slug: "anthropic", name: "Anthropic", website: "https://www.anthropic.com/" };
const google = { slug: "google-deepmind", name: "Google DeepMind", website: "https://deepmind.google/" };
const qwen = { slug: "qwen", name: "Alibaba Qwen", website: "https://qwenlm.github.io/" };
const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });
const withParameter = (url: URL, name: string, value: string) => {
  const next = new URL(url); next.searchParams.set(name, value); return next;
};

export function openaiCatalog(key: string): CatalogAdapter {
  return { source: "openai-discovery", name: "OpenAI Models API", provider: "openai-api", lab: openai, routerNamespace: "openai",
    homepage: "https://developers.openai.com/api/reference/resources/models/methods/list",
    start: new URL("https://api.openai.com/v1/models"), headers: bearer(key),
    parse(payload) {
      return { rows: modelList.parse(payload).data.filter(model => !model.id.startsWith("ft:")).map(model => {
        const externalId = id.parse(model.id);
        return snapshotId.test(externalId) ? { id: externalId, revision: externalId, name: externalId } : { id: externalId };
      }) };
    } };
}

const claude = z.object({ id, display_name: label, created_at: timestamp, line: label.nullish(),
  max_input_tokens: count, max_tokens: count, lifecycle: z.enum(["active", "deprecated", "retired"]).nullish(),
  capabilities: z.record(z.string(), z.object({ supported: z.boolean().optional() }).catch({})).nullish() });
const movingClaude = /-latest$|^claude-(?:3(?:-|\.)|(?:opus|sonnet|haiku)-4(?:-[015])?$)/;

export function anthropicCatalog(key: string): CatalogAdapter {
  return { source: "anthropic-discovery", name: "Claude Models API", provider: "anthropic-api", lab: anthropic, routerNamespace: "anthropic",
    homepage: "https://platform.claude.com/docs/en/api/models/list",
    start: new URL("https://api.anthropic.com/v1/models?limit=1000"),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    parse(payload, url) {
      const data = z.object({ data: z.array(claude), has_more: z.boolean(), last_id: id.nullish() }).parse(payload);
      if (data.has_more && !data.last_id) throw new Error("Missing Claude pagination cursor.");
      return { next: data.has_more ? withParameter(url, "after_id", data.last_id!) : undefined,
        rows: data.data.map(model => {
          if (!snapshotId.test(model.id) && (movingClaude.test(model.id) || !/^claude-[a-z]+-(?:4-[6-9]|[5-9]\d?(?:-\d+)?)(?:$)/.test(model.id))) return { id: model.id };
          const supported = model.capabilities;
          const capabilities = supported ? [
            ...(supported.structured_outputs?.supported ? ["structured-outputs"] : []),
            ...(supported.thinking?.supported ? ["reasoning"] : []),
          ] : undefined;
          const input = ["text", ...(supported?.image_input?.supported ? ["image"] : []), ...(supported?.pdf_input?.supported ? ["pdf"] : [])];
          return { id: model.id, revision: model.id, name: model.display_name, family: model.line ?? undefined,
            releaseDate: model.created_at?.slice(0, 10), contextTokens: model.max_input_tokens ?? undefined,
            inputLimit: model.max_input_tokens ?? undefined, outputLimit: model.max_tokens ?? undefined,
            modalities: { input, output: ["text"] }, capabilities,
            lifecycle: model.lifecycle?.toUpperCase() as CatalogModel["lifecycle"] };
        }) };
    } };
}

export function geminiCatalog(key: string): CatalogAdapter {
  const gemini = z.object({ name: id, baseModelId: id, version: id, displayName: label,
    inputTokenLimit: count, outputTokenLimit: count, supportedGenerationMethods: z.array(z.string()).optional() });
  return { source: "gemini-discovery", name: "Gemini Models API", provider: "gemini-api", lab: google, routerNamespace: "google",
    homepage: "https://aistudio.google.com/api-reference/models",
    start: new URL("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"), headers: { "x-goog-api-key": key },
    parse(payload, url) {
      const page = z.object({ models: z.array(gemini), nextPageToken: z.string().min(1).optional() }).parse(payload);
      return { next: page.nextPageToken ? withParameter(url, "pageToken", page.nextPageToken) : undefined,
        rows: page.models.map(row => {
          if (!row.name.startsWith("models/")) throw new Error("Unexpected Gemini model name.");
          const id = row.name.slice(7);
          if (id !== `${row.baseModelId}-${row.version}` || /(?:latest|preview|exp)$/.test(id)) return { id };
          return { id, revision: row.version, name: row.displayName, family: row.baseModelId,
            inputLimit: row.inputTokenLimit ?? undefined, outputLimit: row.outputTokenLimit ?? undefined };
        }) };
    } };
}

export function qwenCatalog(key: string, workspaceHost: string): CatalogAdapter {
  if (!/^[a-z0-9-]+\.[a-z0-9-]+\.maas\.aliyuncs\.com$/.test(workspaceHost)) throw new Error("Use a documented Alibaba Model Studio workspace host.");
  const model = z.object({ model: id, name: label, provider: id, equivalent_snapshot: id.nullish(),
    published_time: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).nullish(),
    model_info: z.object({ context_window: count, max_input_tokens: count, max_output_tokens: count }).nullish(),
    inference_metadata: z.object({ request_modality: modalities, response_modality: modalities }).nullish(),
    features: z.array(z.string()).nullish(),
    prices: z.array(z.object({ range_name: z.string(), prices: z.array(price) })).nullish() });
  return { source: "qwen-discovery", name: "Alibaba Model Studio", provider: "alibaba-model-studio", lab: qwen, routerNamespace: "qwen",
    homepage: "https://help.aliyun.com/en/model-studio/list-models", headers: bearer(key),
    start: new URL(`https://${workspaceHost}/api/v1/models?providers=qwen&page_no=1&page_size=100`),
    parse(payload, url) {
      const { output } = z.object({ success: z.literal(true), output: z.object({
        total: z.number().int().nonnegative(), page_no: z.number().int().positive(), page_size: z.number().int().positive(), models: z.array(model),
      }) }).parse(payload);
      if (String(output.page_no) !== url.searchParams.get("page_no") || output.models.some(item => item.provider !== "qwen")) {
        throw new Error("Unexpected Model Studio page or publisher.");
      }
      return { total: output.total,
        next: output.page_no * output.page_size < output.total ? withParameter(url, "page_no", String(output.page_no + 1)) : undefined,
        rows: output.models.map(row => {
          const target = row.equivalent_snapshot;
          if (target && target !== row.model) return { id: row.model, target };
          if (!snapshotId.test(row.model) && target !== row.model) return { id: row.model };
          const text = row.inference_metadata?.request_modality.includes("Text") && row.inference_metadata.response_modality.includes("Text");
          const flat = row.prices?.length === 1 && row.prices[0].range_name === "Default" ? row.prices[0].prices : [];
          const rates = (type: string) => flat.filter(p => p.type === type && p.time_band === "standard" && p.price_unit === "每百万tokens");
          const [input, output] = [rates("input_token"), rates("output_token")];
          const china = workspaceHost.split(".")[1] === "cn-beijing";
          return { id: row.model, revision: row.model, name: row.name, releaseDate: row.published_time?.slice(0, 10),
            contextTokens: text ? row.model_info?.context_window ?? undefined : undefined,
            inputLimit: text ? row.model_info?.max_input_tokens ?? undefined : undefined,
            outputLimit: text ? row.model_info?.max_output_tokens ?? undefined : undefined,
            modalities: row.inference_metadata ? { input: row.inference_metadata.request_modality.map(x => x.toLowerCase()),
              output: row.inference_metadata.response_modality.map(x => x.toLowerCase()) } : undefined,
            capabilities: row.features?.flatMap(x => x === "function-calling" ? ["tool-calling"] : x === "structured-outputs" ? [x] : []),
            price: china && text && input.length === 1 && output.length === 1 ? { currency: "CNY", input: input[0].price, output: output[0].price } : undefined };
        }) };
    } };
}

export function huggingFaceCatalog(owner: string, lab: CatalogAdapter["lab"], key?: string): CatalogAdapter {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(owner)) throw new Error("Invalid reviewed Hugging Face publisher.");
  const repository = z.object({ id, sha: z.string().regex(/^[a-f0-9]{40}$/),
    private: z.boolean().optional(), gated: z.union([z.boolean(), z.string()]).optional(),
    cardData: z.object({ license: label.nullish() }).nullish() });
  const start = new URL("https://huggingface.co/api/models");
  start.searchParams.set("author", owner);
  for (const field of ["sha", "private", "gated", "cardData"]) start.searchParams.append("expand[]", field);
  return { source: `hf-${owner.toLowerCase()}`, name: `Hugging Face · ${owner}`, lab, homepage: `https://huggingface.co/${owner}`,
    start, headers: key ? bearer(key) : undefined,
    parse(payload, url, headers) {
      const rows = z.array(repository).parse(payload);
      if (rows.some(row => row.id.split("/")[0] !== owner || row.private)) throw new Error("Unexpected publisher or private repository.");
      const link = headers.get("Link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      return { next: link ? new URL(link, url) : undefined,
        rows: rows.map(row => ({ id: row.id, revision: row.sha, name: row.id.split("/")[1],
          license: row.cardData?.license ?? undefined, url: `https://huggingface.co/${row.id}/tree/${row.sha}` })) };
    } };
}
