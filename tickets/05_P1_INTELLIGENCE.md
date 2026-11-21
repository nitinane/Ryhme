# P1_INTELLIGENCE — Advisor and data ingestion

**Priority:** P1

## Objective
Implement validated Groq query interpretation and explainable advisor with deterministic fallback; OpenRouter/HF incremental adapters, run logs, cron/manual admin sync.

## Execution checklist
- [ ] Inspect existing implementation and avoid overwriting unrelated work.
- [ ] Implement the smallest end-to-end slice with typed boundaries and Zod validation.
- [ ] Add loading, empty and failure states; verify mobile/keyboard behavior.
- [ ] Add focused unit/contract/integration tests and relevant Playwright coverage.
- [ ] Run lint, typecheck, tests and build; report exact outcomes.
- [ ] Update docs, note unresolved issues, and report milestone checkpoint.

## Acceptance criteria
Source-backed recommendations, no generated SQL, quotas bounded, failed ingestion retains records, admin-only trigger.

## Security/data invariants
Source attribution for catalog facts; no fabricated values; server-side authorization for private operations; bounded requests; safe migrations; no secrets in logs. See `AGENTS.md` and documents 04–09.

## Completion record
Status: TODO  
Commit: ______  
Tests: ______  
Deployment evidence: ______  
Blockers: ______
