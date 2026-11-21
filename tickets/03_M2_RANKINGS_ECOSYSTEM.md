# M2_RANKINGS_ECOSYSTEM — Rankings, labs, providers and responsive UX

**Priority:** P0

## Objective
Implement benchmark-specific rankings with methodology/date/source; distinct labs and providers with offering links; dark-first mobile and keyboard UX; dynamic metadata.

## Execution checklist
- [ ] Inspect existing implementation and avoid overwriting unrelated work.
- [ ] Implement the smallest end-to-end slice with typed boundaries and Zod validation.
- [ ] Add loading, empty and failure states; verify mobile/keyboard behavior.
- [ ] Add focused unit/contract/integration tests and relevant Playwright coverage.
- [ ] Run lint, typecheck, tests and build; report exact outcomes.
- [ ] Update docs, note unresolved issues, and report milestone checkpoint.

## Acceptance criteria
No invalid composite score; rank direction correct; mobile at 375px; keyboard workflows; six mandatory modules pass smoke.

## Security/data invariants
Source attribution for catalog facts; no fabricated values; server-side authorization for private operations; bounded requests; safe migrations; no secrets in logs. See `AGENTS.md` and documents 04–09.

## Completion record
- Status: Locally verified.
- Product: Benchmark-specific coding, reasoning, and mathematics leaderboards, separate searchable lab and provider directories, cross-linked model evidence, and homepage catalog stats and featured versions.
- Catalog: Four model versions, two labs, two API providers, and eight verified source-attributed result rows across three benchmarks. Sources include OpenAI's launch report, Google DeepMind's Gemma card on Hugging Face, and the OpenRouter endpoint listing.
- Checks: `npm run lint`, `npm run typecheck`, `npm test` (13 passed), `npm run build`, and `npm run test:e2e` (8 passed). Chromium covered 375 px mobile, 768 px tablet, and desktop. Keyboard checks included skip navigation, search dialog focus, filtering, and category navigation. The outage test verified safe API errors and page recovery controls.
- Database: All three migrations and the offline seed passed on fresh disposable PostgreSQL. The upgrade path also passed repeat seeding and schema drift checks. The live OpenRouter metadata command preserved the seeded record counts.
- Hosted verification: Neon development connectivity, remote Actions, and Vercel Preview need account configuration. See the deployment runbook for the exact steps and the investigation of the pg 8 deprecation warning.
