# 03 — Application Flow and UX Specification

## 1. Navigation
Public: `/` landing, `/models`, `/models/[slug]`, `/compare`, `/rankings`, `/labs`, `/labs/[slug]`, `/providers`, `/providers/[slug]`. Optional: `/advisor`, `/workspace`, `/admin`, `/playground`, `/api-docs`. Sign-in route handled by Auth.js. Unknown routes: friendly 404.

## 2. Landing
Compact dark-first hero, `Ctrl/Cmd+K` global search, real catalog statistics (from DB; no hardcoded live counts), featured verified models, top category links, comparison CTA, labs/providers links. All CTAs functional; no dead navigation.

## 3. Discovery flow
1. User enters query or opens command search; debounce and sync to URL.
2. Search results rendered from server API with stable pagination and result count.
3. Filters: lab, modalities, context, open weights/license, provider, price if available, capabilities, lifecycle.
4. Sort by name, release date, context size, or applicable price; preserve URL state.
5. Add/remove comparison candidates; cap four; button disabled below two.
6. Empty state offers clear filters; error state offers retry; loading skeletons avoid layout shift.

## 4. Model detail
Header: family/version, lab, lifecycle, release date, sourced metadata. Sections: capabilities, context, licensing/open-weight status, provider offerings/prices, benchmarks, references, related versions. Display freshness and verification badges for individual facts, not a misleading blanket certification. Link to comparison and report inaccurate data (P1).

## 5. Comparison flow
Select 2–4 distinct model IDs via cards or URL. Comparison table groups identity, capabilities, context, license, benchmarks, provider pricing. Show unknown instead of blank/zero. Token cost calculator takes input/output tokens and selected provider offerings, uses explicit units/currency. Share URL encodes IDs only (no private content). On mobile, accessible horizontally scrollable matrix with sticky labels where feasible and a compact stacked alternative if needed.

## 6. Rankings flow
Choose category and benchmark; show benchmark title, methodology/version, direction, unit, source and evaluation date. Table sorted on comparable scores; optional filters for model type/provider. Do not present universal ranking when cross-benchmark data is incompatible.

## 7. Labs vs providers
Labs create or publish models; providers host/serve offerings. Separate directories, detail pages, counts derived from database, and cross-links. Provider detail shows available offerings and observed prices; don't claim real-time availability unless verified.

## 8. Advisor (P1)
User describes use case, budget, context, constraints. Parse into validated structured preferences; apply deterministic eligibility and explainable ranking. Show ranked candidates with criteria, tradeoffs, source links and a notice about unknowns. Groq writes an optional explanation; fallback shows deterministic summary. Reject unsafe/unbounded inputs.

## 9. Workspace (P1)
Public browse -> Google sign-in -> session -> `/workspace` bookmarks, saved comparisons, preferred providers/workload preferences. Sign-out returns to public pages. Save actions require authenticated server session and ownership checks. Failed sign-in doesn't block public catalog.

## 10. Admin (P1)
Admin role only: catalog health, recent ingestion runs, manual sync button with confirmation and throttling, correction reports. No direct free-form SQL editor. Deny unauthorized access on server, not just in UI.

## 11. Responsive/accessibility states
Desktop navigation sidebar/topbar; mobile drawer; mobile search/filter drawer; accessible dialogs; Escape closes overlays; focus returns to trigger; all icon buttons labeled; charts have text equivalents; no color-only status; reduced motion. Aim WCAG 2.2 AA. Keyboard test: global search, filtering, selecting comparison, reading model page, switching rankings.

## 12. Demo walkthrough
Landing/search -> filter -> detail with provenance -> add 3 models -> compare/cost calculator -> category leaderboard -> lab/provider differentiation -> optional advisor -> submission links. Seed records must make this journey reproducible; don't depend on live API calls during recording.
