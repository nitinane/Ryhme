# 09 — Deployment, Testing and Recovery Runbook

## 1. Prerequisites
Node.js active LTS supported by chosen Next.js version, pnpm or npm (choose one and commit lockfile), Neon development and production DBs, Vercel account, GitHub repository, optional Google OAuth/Groq/OpenRouter/HF credentials. Do not require paid services for P0.

## 2. Local setup (example using pnpm; adapt to actual package scripts)
```bash
corepack enable
pnpm install
cp .env.example .env.local
# Set development DATABASE_URL and other required variables
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```
On Windows PowerShell use `Copy-Item .env.example .env.local`. `prisma` scripts may be exposed as `pnpm exec prisma ...`; confirm actual package.json. Seed must be repeatable and never fabricate sourced data.

## 3. Environment isolation
- Neon **dev** DB for local/preview; separate Neon **production** DB for live app. Prefer isolated preview branches if available and affordable.
- Vercel env scopes: development, preview, production. Preview never receives production DB credentials.
- OAuth redirect URLs must match actual environments; do not invent callback URLs.
- GitHub Actions secrets use least privilege; never print env values.

## 4. CI pipeline
On PR and main push: dependency install with frozen lockfile -> formatting/lint -> `tsc --noEmit` -> Vitest unit/contract tests -> Prisma generate/migration checks on disposable DB where configured -> Next.js build. Playwright critical-path E2E on local preview/test DB. Live upstream smoke is **manual/opt-in** and quota-bounded.

## 5. Production migration and deploy
1. Review migration SQL, confirm production target and data backup/recovery path.
2. Run tests against development database; ensure seed/migration compatible.
3. Apply `prisma migrate deploy` in a **single controlled production step**; never run `migrate dev`, `db push`, or `migrate reset` against production.
4. Deploy Vercel production build; verify runtime envs and DB connectivity.
5. Smoke test all six modules; check logs and source timestamps.
6. If migration incompatible, stop deployment; do not attempt unsafe down-migrations without a reviewed plan.

## 6. Test matrix
| Layer | Cases | Tool |
|---|---|---|
| Unit | normalization, price math, ranking direction, filters, missing values | Vitest |
| Contract | request/response schemas, 400/401/403/404/429, upstream malformed/timeouts | Vitest + fixtures |
| DB integration | seed idempotence, unique IDs, ownership isolation, benchmark associations | Prisma + disposable PostgreSQL |
| E2E | discover -> detail -> compare -> rank -> lab/provider | Playwright |
| Accessibility | keyboard navigation, dialog focus, mobile filter, labels, contrast | Playwright + axe where practical, manual checks |
| Live smoke | Vercel URL, DB reads, auth callback, optional Groq adapter | manual/opt-in |
| Security | role escalation, cross-user data, injection, rate limiting, secret exposure | unit/integration |

## 7. Failure modes
- Groq down -> deterministic advisor or keyword search; P0 unaffected.
- External catalog source down -> preserve existing sourced rows, log failure, show freshness.
- OAuth misconfigured -> public pages still work; workspace disabled with helpful message.
- DB unavailable -> safe 503/error UI; do not show fabricated cached results as current.
- Missing benchmark -> display unknown/unranked; no zero substitution.
- Cron exceeds runtime -> reduce batch size and resume via cursor; no background promise after serverless termination.

## 8. Backup and recovery
Document Neon's actual plan-specific backup/restore capability before relying on it. Before destructive migrations, take a verified logical export or available branch/snapshot according to provider support. Verify restoration to a **non-production** database. Treat user bookmarks/preferences as irreplaceable. Never expose exports in public repo or Loom. Require explicit approval for production destructive operations.

## 9. Production smoke script
- `/` loads and real catalog stats displayed.
- `/models` search, filters, sort, pagination and URL restore work.
- A seeded `/models/[slug]` shows sourced version/offering information.
- Compare 2–4 models; invalid input handled; cost arithmetic checked against manual calculation.
- `/rankings` shows benchmark methodology and valid sorting.
- `/labs` and `/providers` show distinct linked records.
- 375px mobile layout usable; keyboard search/dialog tested.
- Inspect browser console, Vercel logs, no exposed secrets.
- Optional P1 flows tested only if enabled.

## 10. Final submission deadline gate
**Before 2026-11-23 19:00 IST:** verify public Vercel URL, GitHub URL with readable README and no secrets, Loom URL with playback permissions, six-module checklist, last CI run, smoke evidence, and submission portal/form completion. Target earlier than deadline for upload/network buffer. Do not claim submission completed until actual external confirmation.
