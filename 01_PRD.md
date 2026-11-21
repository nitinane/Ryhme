# 01 — Product Requirements Document (PRD)

## 1. Problem
Developers choosing LLMs face fragmented model specifications, inconsistent benchmark reporting, provider-specific prices, changing versions, and marketing-driven comparisons. Ryhme unifies sourced, comparable information and provides an explainable selection workflow. Do not assert unsupported market-size statistics.

## 2. Users and jobs
- **Application developer:** find models by modality, licensing, context, capability, provider, and cost; compare up to four candidates.
- **Technical lead:** assess tradeoffs, evaluation dates, and deployment options.
- **Researcher/student:** browse benchmark results with clear provenance and methodology.
- **Admin:** review ingestion freshness and reported inaccuracies.

## 3. Product outcomes
- Users can find and filter relevant models without signing in.
- Every model detail page distinguishes model identity/version from provider offerings.
- Comparison shows aligned specifications, missing data, and deterministic cost estimates.
- Rankings avoid unsupported universal scores; individual metrics have source/methodology/date.
- Labs and inference providers are separate entities and navigable.
- Responsive, keyboard-operable, WCAG 2.2 AA-targeted UI.

## 4. Mandatory P0 modules
| Module | Required behavior | Acceptance evidence |
|---|---|---|
| Discovery | Search, filters, sort, pagination, shareable URL state | Search real seeded DB; filters change results and URL |
| Model detail | Version, lab, capabilities, context, license, pricing, benchmarks, sources | Public `/models/[slug]` populated by DB |
| Comparison | Select 2–4 models, side-by-side differences, cost estimates | Shareable `/compare?models=...` with accurate arithmetic |
| Rankings | Category leaderboard, metric units/direction, provenance | Ranked records trace to benchmark results |
| Labs/providers | Distinct lab and provider directories/details, offerings and prices | Navigable pages with correct relationships |
| Product UX | Dark-first Linear-inspired responsive experience, keyboard access | Desktop/mobile smoke and accessibility checks |

## 5. P1 features (only after P0 checkpoint)
- Explainable AI Advisor: deterministic eligibility/ranking, Groq explanation, source references and offline fallback.
- Auth.js Google OAuth, saved models/comparisons and user preferences/dashboard.
- Scheduled incremental ingestion with logs and protected manual trigger.
- Lightweight admin stats, job monitoring, correction reports.
- Privacy-conscious aggregate analytics; data-report form; OpenAPI reference; enhanced SEO.

## 6. P2 stretch
Groq-only playground with supported model list, bounded prompt input, allowed parameter controls, latency/token reporting when available, and optional response comparison. Never present arbitrary catalog models as runnable.

## 7. User stories and acceptance
1. **Discover:** Given a seeded catalog, when I filter `open weights` and sort by context length, results are filtered and sorted server-side, pagination stable and URL restorable.
2. **Inspect:** Given a model slug, I see its family/version, lifecycle, lab, capabilities, evidence and provider offerings; unknown values are shown as unknown.
3. **Compare:** Given 2–4 IDs, I see aligned attributes and can estimate cost for a user-supplied token workload; invalid counts rejected.
4. **Rank:** Given a benchmark category, I see comparable scores with units, direction, dates, methodology and sources; missing values are unranked.
5. **Browse ecosystem:** I can distinguish who developed a model from who serves it and view each provider's offering.
6. **Mobile:** At narrow widths, discovery uses cards/drawer and comparisons remain usable via accessible horizontal scrolling or grouped panels.

## 8. Product principles
- Source-backed facts; no fabricated benchmark scores, model counts, prices, or live availability.
- Missing data is explicit, not treated as zero.
- Public core, optional login for persistence.
- Deterministic data operations; AI may interpret/explain, not invent.
- Keep catalog useful during upstream outages.

## 9. Scope guardrails
No custom model training, community ratings, paid APIs without approval, public developer API keys, complex CMS, vector search, Redis, independent workers, or custom billing system. Do not imply P1/P2 features are implemented before verified.

## 10. Success measures
P0: all six modules demonstrably working on production; no broken primary links; lint/typecheck/build/tests pass; keyboard/mobile workflows verified; GitHub and Loom ready by deadline. P1 metrics may include aggregate search and compare actions without storing raw private prompts.
