# 05 — API Integration and Contract Specification

## 1. Conventions
Base `/api`. JSON response envelope: `{ "data": ..., "meta"?: ..., "error"?: { "code": string, "message": string } }`. ISO-8601 timestamps, stable IDs/slugs, nullable unknowns. Errors: 400 invalid input, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict, 429 rate-limited, 502 upstream failure, 503 temporary unavailable. Never leak raw upstream errors or secrets. Use Zod for input and output schemas; generate OpenAPI from the same contracts where practical.

## 2. P0 endpoints
| Method/path | Input | Output | Notes |
|---|---|---|---|
| GET `/api/models` | `q`, `lab`, `provider`, `modality`, `openWeights`, `minContext`, `sort`, `page`, `limit` | paginated model summaries + filters/meta | validated, indexed, bounded |
| GET `/api/models/:slug` | slug | detail, versions, offerings, sources, benchmark excerpts | 404 on missing |
| GET `/api/compare` | repeated `modelId` or comma-separated IDs (choose one canonical form) | 2–4 aligned model details, offerings | reject duplicates/invalid IDs |
| POST `/api/compare/cost` | offering IDs, inputTokens, outputTokens | cost estimates or `null` + reason | server-side decimal math |
| GET `/api/rankings` | `benchmark`, `category`, `page`, `limit` | ranked comparable results + benchmark metadata | no invented composite |
| GET `/api/labs` / `/api/labs/:slug` | search/page | labs and their model families | separate from providers |
| GET `/api/providers` / `/api/providers/:slug` | search/page | providers, offerings, sourced pricing | freshness shown |
| GET `/api/health` | none | public safe health status | no secrets or internal DB URLs |

## 3. P1 endpoints
| Method/path | Purpose | Access |
|---|---|---|
| POST `/api/search/interpret` | Groq NL query -> validated filter DTO; deterministic fallback | public, tight rate limit |
| POST `/api/advisor` | bounded requirements -> eligible models + ranked rationale + optional Groq prose | public, tight rate limit |
| GET/POST/DELETE `/api/workspace/bookmarks` | bookmark CRUD | authenticated owner |
| GET/POST/DELETE `/api/workspace/comparisons` | saved comparisons | authenticated owner |
| GET/PATCH `/api/workspace/preferences` | user settings | authenticated owner |
| GET `/api/admin/ingestion` | ingestion run logs | admin |
| POST `/api/admin/ingestion/run` | queue or execute bounded sync | admin + CSRF/authorization + rate limit |
| GET/PATCH `/api/admin/reports` | correction review | admin |
| POST `/api/reports` | submit data correction | validated, rate-limited |
| GET `/api/openapi.json` | OpenAPI 3 specification | public, hide privileged examples/secrets |

## 4. P2 endpoint
POST `/api/playground/run`: Groq-supported model ID, bounded prompt, allowlisted temperature/maxTokens; returns text, latency and token usage if upstream provides it. Enforce stricter quotas and no arbitrary provider API keys.

## 5. Example model list request/response (illustrative, not live data)
```http
GET /api/models?q=reasoning&minContext=128000&page=1&limit=20
```
```json
{
  "data": [{"id":"example-id","slug":"example-model-version","name":"Example Model","contextTokens":128000,"openWeights":null}],
  "meta":{"page":1,"limit":20,"total":1,"hasMore":false}
}
```
Examples are schematic; **do not seed or display `Example Model` as a real sourced model**.

## 6. External source adapters
- **OpenRouter:** fetch supported catalog/pricing fields from documented public APIs; normalize model IDs, context, modalities and pricing units; store source URL and fetch timestamp. Validate endpoint/field shape against current official docs during implementation.
- **Hugging Face:** ingest supported open-model metadata, licensing, repository identity and task information where available. API fields do not automatically prove benchmark performance.
- **Official lab/provider documentation:** source canonical versions, release dates and capabilities; manual curated entries where APIs unavailable.
- **Benchmark publications/datasets:** ingest only results with identifiable benchmark, methodology/version, model version, date and source; never merge unlike evaluations.

## 7. Adapter safeguards
Timeout per upstream call; bounded retries only for transient idempotent GETs; respect 429/Retry-After and provider quotas; use conditional requests/pagination if available; normalize currency/price units; preserve original raw IDs/checksums; log counts and sanitized errors. Never scrape websites in violation of source terms or pretend an API is available without verification.

## 8. OpenAPI workflow
Define schemas once (Zod), derive OpenAPI where tooling supports it, validate generated spec in CI, and expose a lightweight interactive viewer only if it does not compromise P0 deadline. No public API key program or SDK generation.

## 9. Example Zod contract
```ts
const ModelListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  minContext: z.coerce.number().int().nonnegative().optional(),
  openWeights: z.enum(['true', 'false']).optional(),
  sort: z.enum(['name', 'release', 'context']).default('name'),
});
```
Other filters should be enumerated and validated rather than accepted as arbitrary SQL fragments.
