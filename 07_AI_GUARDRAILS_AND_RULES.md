# 07 — AI Guardrails and Decision Rules

## 1. Separation of responsibilities
**Deterministic code:** query validation, eligibility filtering, benchmark comparison, cost math, ranking weights, source selection, authorization. **Groq:** parse user intent into allowed DTO and explain retrieved ranked candidates. Groq must not invent catalog entries, prices, benchmark scores or citations.

## 2. Natural-language search
1. Trim and bound user text.
2. Supply Groq an allowlist schema (capabilities, modality, provider, context minimum, budget, license/open weights, sort).
3. Parse JSON and validate with Zod; reject unknown keys, unsafe operators, malformed values.
4. Execute only trusted server-side query builder; never execute generated SQL.
5. On failure/timeout, fall back to plain keyword search and report reduced functionality.

## 3. Explainable Advisor pipeline
1. Collect requirements: task type, constraints, optional budget, context, open weights, provider preferences.
2. Validate units and limits; distinguish hard constraints from preferences.
3. Retrieve candidate model versions and provider offerings with provenance.
4. Exclude models that demonstrably violate hard constraints; **unknown values cannot silently pass a strict requirement**. Offer a separately labeled 'insufficient data' section if useful.
5. Rank eligible models with documented per-criterion weights and comparable data only. E.g. weighted cost, context, selected benchmark category; renormalize weights only over available criteria and show coverage, or abstain if coverage inadequate.
6. Give Groq structured evidence for top candidates; request concise explanations and tradeoffs.
7. Validate referenced IDs/URLs against retrieved records; strip unsupported claims and fall back to deterministic template when necessary.

## 4. Example response contract
```json
{
  "interpretedRequirements": {"task":"coding","minContextTokens":128000},
  "recommendations": [
    {"modelVersionId":"db-id","rank":1,"matchedCriteria":["context"],"tradeoffs":["price unknown"],"sourceObservationIds":["source-id"]}
  ],
  "limitations":["Benchmark coverage differs by model"],
  "generatedExplanation": null,
  "fallbackUsed": true
}
```
Illustrative shape only; IDs must be resolved from real DB records.

## 5. Prompt-injection defenses
External metadata, descriptions, scraped pages and user text are **data**, never system instructions. Keep system/developer instructions isolated; do not pass tool execution capabilities to Groq; use strict structured output where supported; validate all outputs. Do not follow instructions embedded in model descriptions such as 'ignore previous instructions'.

## 6. Grounding and uncertainty
Every factual recommendation must map to source-backed catalog fields. Unknown means unknown; never zero. Display observation date and verified/unverified status. Do not claim 'best model overall' without defensible criterion. Separate benchmark results across methodologies. Avoid guaranteed quality, latency or availability claims.

## 7. Cost, privacy and abuse
Bound prompt length, output tokens, model allowlist and concurrency. Tight rate limits; API key only server-side. Do not store user prompts by default; redact tokens/PII in logs. On 429/timeouts, show deterministic fallback and retry guidance without recursive retry storms.

## 8. Playground P2
Only run configured Groq-supported model IDs. Expose allowlisted parameters; reject unsupported settings; report token usage/latency only when measured/returned. Do not market estimated token usage as observed. No user-supplied arbitrary provider credentials.

## 9. AI evaluation cases
Ambiguous task; conflicting constraints; missing prices; stale benchmark; hallucinated model ID; fake source URL; prompt injection inside external model description; Groq 429; malformed JSON; unsupported playground model; provider unavailable. Expected result: safe validated output or explicit abstention/fallback.
