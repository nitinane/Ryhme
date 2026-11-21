# M1_CATALOG — Discovery, model details and comparison

**Priority:** P0

## Objective
Implement indexed search/filters/sort/pagination/URL state, sourced model detail pages, 2–4 comparison and decimal-safe token cost estimates.

## Execution checklist
- [ ] Inspect existing implementation and avoid overwriting unrelated work.
- [ ] Implement the smallest end-to-end slice with typed boundaries and Zod validation.
- [ ] Add loading, empty and failure states; verify mobile/keyboard behavior.
- [ ] Add focused unit/contract/integration tests and relevant Playwright coverage.
- [ ] Run lint, typecheck, tests and build; report exact outcomes.
- [ ] Update docs, note unresolved issues, and report milestone checkpoint.

## Acceptance criteria
Real DB data; missing values explicit; 400 on invalid comparison; responsive empty/loading/error states; unit/integration/E2E pass.

## Security/data invariants
Source attribution for catalog facts; no fabricated values; server-side authorization for private operations; bounded requests; safe migrations; no secrets in logs. See `AGENTS.md` and documents 04–09.

## Completion record
- Status: Locally verified.
- Checks: `npm run lint`, `npm run typecheck`, `npm test` (9 passed), `npm run build`, and `npm run test:e2e` (5 passed).
- Database: The additive catalog index migration applied to disposable PostgreSQL. Prisma reported no schema differences. PostgreSQL could plan the full-text predicate against the new GIN index. Both seed runs passed the database checks.
- Acceptance evidence: Browser tests covered URL-backed search, filters, stable pages, model evidence, keyboard search and mobile filters, comparison selection and sharing, and exact historical cost estimates. Local Chromium also verified empty and database-outage pages. API tests covered invalid requests and missing records.
- Limits: The source-attributed seed has three versions, so the browser exercise compares three. Input validation covers the four-model maximum. Prices are dated observations. The pinned Prisma/pg stack emits a concurrent-query deprecation warning on the catalog read path and passed local verification.
- Hosted verification: Neon development connectivity, the remote GitHub Actions run, and Vercel preview remain pending. See the hosted handoff in the deployment runbook.
