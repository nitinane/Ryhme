# M0_FOUNDATION — Foundation, database, CI

**Priority:** P0

## Objective
Scaffold Next.js/TS/Tailwind; environment validation; Prisma + isolated Neon dev DB; reviewed schema; verified deterministic seed; basic CI and deployment skeleton.

## Execution checklist
- [ ] Inspect existing implementation and avoid overwriting unrelated work.
- [ ] Implement the smallest end-to-end slice with typed boundaries and Zod validation.
- [ ] Add loading, empty and failure states; verify mobile/keyboard behavior.
- [ ] Add focused unit/contract/integration tests and relevant Playwright coverage.
- [ ] Run lint, typecheck, tests and build; report exact outcomes.
- [ ] Update docs, note unresolved issues, and report milestone checkpoint.

## Acceptance criteria
Install, lint, typecheck, test, build pass; seed twice without duplication; public homepage and DB-backed count; no secrets committed.

## Security/data invariants
Source attribution for catalog facts; no fabricated values; server-side authorization for private operations; bounded requests; safe migrations; no secrets in logs. See `AGENTS.md` and documents 04–09.

## Completion record
- Status: Locally verified. Hosted connectivity and CI remain pending.
- Tests: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test` (3 passed), `npm run build`, and `npm run test:e2e` (1 passed).
- Database: Applied the initial migration to disposable PostgreSQL and ran `npm run db:seed` twice. `npm exec -- tsx tests/seed-check.ts` passed after each run. The homepage and health route were also checked against an empty catalog and an unreachable database.
- Dependency audit: `npm audit` reported zero vulnerabilities.
- Deployment evidence: Local production build and mobile Chromium smoke. GitHub Actions workflow is present. Hosted checks require an isolated Neon development connection, a GitHub remote, and a Vercel project.
