# M3_DEPLOY_SUBMIT — Deployment and evaluator evidence

**Priority:** P0

## Objective
Configure GitHub Actions, Vercel production + Neon production, controlled Prisma migration, run smoke and accessibility tests; finish README, demo script, Loom and submission checklist.

## Execution checklist
- [ ] Inspect existing implementation and avoid overwriting unrelated work.
- [ ] Implement the smallest end-to-end slice with typed boundaries and Zod validation.
- [ ] Add loading, empty and failure states; verify mobile/keyboard behavior.
- [ ] Add focused unit/contract/integration tests and relevant Playwright coverage.
- [ ] Run lint, typecheck, tests and build; report exact outcomes.
- [ ] Update docs, note unresolved issues, and report milestone checkpoint.

## Acceptance criteria
Actual public URL works; CI green; GitHub link valid; Loom link accessible; no exposed secrets; submission confirmed before deadline.

## Security/data invariants
Source attribution for catalog facts; no fabricated values; server-side authorization for private operations; bounded requests; safe migrations; no secrets in logs. See `AGENTS.md` and documents 04–09.

## Completion record
- Status: Preview preparation verified locally. Hosted steps are pending.
- Local verification: Lint, TypeScript, Vitest (16 passed), the production build, and Playwright (9 passed) against disposable PostgreSQL. Repeated migration deployment was a no-op, schema drift was clear, and both seed runs passed. Simulated Vercel Preview served the catalog. Simulated Vercel Production returned a safe 503 with the same reachable database configured.
- Security: Redacted Gitleaks history review found two matches for the public benchmark evaluation key. The staged preparation and tracked credential-path checks found no credentials. The build test credential marker was absent from public assets. npm audit reported zero known vulnerabilities.
- Hosted handoff: Confirm the Neon project or branch, GitHub repository and branch, and Vercel team and project. Approve the exact Neon writes, GitHub push, and Vercel Preview deployment separately. See the deployment runbook for the commands and smoke checks.
