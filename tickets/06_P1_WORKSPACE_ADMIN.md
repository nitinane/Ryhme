# P1_WORKSPACE_ADMIN — Workspace, reports, analytics and API docs

**Priority:** P1

## Objective
Auth.js Google OAuth, owner-isolated bookmarks/comparisons/preferences, protected admin dashboard, correction reports, aggregate analytics, OpenAPI reference.

## Execution checklist
- [ ] Inspect existing implementation and avoid overwriting unrelated work.
- [ ] Implement the smallest end-to-end slice with typed boundaries and Zod validation.
- [ ] Add loading, empty and failure states; verify mobile/keyboard behavior.
- [ ] Add focused unit/contract/integration tests and relevant Playwright coverage.
- [ ] Run lint, typecheck, tests and build; report exact outcomes.
- [ ] Update docs, note unresolved issues, and report milestone checkpoint.

## Acceptance criteria
Unauthorized 401/403; cross-user access denied; reports moderated; no raw private prompts in analytics; OpenAPI spec validates.

## Security/data invariants
Source attribution for catalog facts; no fabricated values; server-side authorization for private operations; bounded requests; safe migrations; no secrets in logs. See `AGENTS.md` and documents 04–09.

## Completion record
Status: TODO  
Commit: ______  
Tests: ______  
Deployment evidence: ______  
Blockers: ______
