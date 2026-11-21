# P2_PLAYGROUND — Groq developer playground

**Priority:** P2

## Objective
Groq allowlisted models, prompt controls, response and latency/token metadata when available, usage limits and safe errors.

## Execution checklist
- [ ] Inspect existing implementation and avoid overwriting unrelated work.
- [ ] Implement the smallest end-to-end slice with typed boundaries and Zod validation.
- [ ] Add loading, empty and failure states; verify mobile/keyboard behavior.
- [ ] Add focused unit/contract/integration tests and relevant Playwright coverage.
- [ ] Run lint, typecheck, tests and build; report exact outcomes.
- [ ] Update docs, note unresolved issues, and report milestone checkpoint.

## Acceptance criteria
Unsupported model rejected; token/cost metadata not fabricated; upstream 429 handled; optional feature hidden if incomplete.

## Security/data invariants
Source attribution for catalog facts; no fabricated values; server-side authorization for private operations; bounded requests; safe migrations; no secrets in logs. See `AGENTS.md` and documents 04–09.

## Completion record
Status: TODO  
Commit: ______  
Tests: ______  
Deployment evidence: ______  
Blockers: ______
