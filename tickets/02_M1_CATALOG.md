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
Status: TODO  
Commit: ______  
Tests: ______  
Deployment evidence: ______  
Blockers: ______
