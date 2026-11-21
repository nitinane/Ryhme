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

## Hosted verification handoff

Ryhme uses the existing Neon project `oneAtlas`, branch `development`, database `neondb`, and role `neondb_owner`.

1. **Neon identity check.** In Neon Console, select an isolated development project or branch. Confirm the project and branch in the dashboard, then record the direct endpoint hostname, database name, and role from **Connect**. Obtain those expected values independently of the connection strings being checked. In gitignored `.env.local`, set `DATABASE_URL` to the pooled URL and `DIRECT_URL` to the direct URL for that same target. Use one shell with these file settings and check for any inherited overrides. Enter credentials privately in the local file or hosting dashboard. [Neon connection instructions](https://neon.com/docs/connect/connect-from-any-app)
2. **Read-only preflight.** Run `npm run db:verify:neon -- <direct-host> <database> <role>`. The command checks both URLs against the console identity, connects with verified TLS, and checks the server-reported database and role. Its output identifies each variable without showing connection details. A failed check stops the handoff. The Console check establishes which branch is development. [Neon connection pooling](https://neon.com/blog/better-postgres-with-prisma-experience)
3. **Neon writes after approval.** Obtain explicit approval to migrate and seed that exact development target. Re-run the read-only preflight in the same environment immediately before `npm run db:migrate`. Run `npm run db:seed` twice and check that counts stay stable. Use `npm exec -- tsx tests/seed-check.ts` when the database contains only this seed. Verify schema drift with `npm exec -- prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`.
4. **GitHub after push approval.** Confirm the intended branch for `nitinane/Ryhme` and GitHub access. Review the prepared commit, add the approved repository as `origin`, then push the explicitly approved branch. Check the **Ryhme CI** run for that commit in GitHub Actions. Pushes to `main` and pull requests run the workflow. It uses a disposable PostgreSQL service with local test credentials. [Intended Ryhme repository](https://github.com/nitinane/Ryhme) · [GitHub push instructions](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository)
5. **Vercel Preview after deployment approval.** Confirm the Vercel team and project. Use the repository root, the Next.js preset, Node.js 24, and the checked-in `vercel.json`. Before linking any Git integration, confirm that no import or automatic deployment will be triggered. Keep **Automatically expose System Environment Variables** enabled. Add the pooled `DATABASE_URL` under **Preview** only and confirm it is absent from Production. Keep `DIRECT_URL` local. The checked-in configuration disables automatic Git deployments and the app and Prisma reject database access in Vercel Production for this Preview handoff. Use an approved manual `vercel deploy` and record the deployment URL. [Git deployment settings](https://vercel.com/docs/project-configuration/git-configuration) · [System variables](https://vercel.com/docs/environment-variables/system-environment-variables) · [Preview deployment](https://vercel.com/docs/projects/deploy-from-cli)
6. **Hosted smoke.** Check `/api/health`, the homepage counts, `/rankings` methodology and sources, `/labs/google-deepmind`, and `/providers/openrouter`. Search and filter `/models`, open a model detail, and verify a four-model comparison, a shared URL, and a token estimate. Repeat key steps at 375 px with keyboard navigation. Check page source, browser requests, and error payloads for credentials. For hosted outage smoke, use a separately approved disposable Preview that has an intentionally absent database URL. Verify a sanitized `503` and the outage UI there while leaving the healthy Preview and its database in service.

## PostgreSQL driver compatibility

The catalog uses an interactive repeatable-read transaction to keep counts and page rows consistent. The pinned Prisma adapter can issue relation queries concurrently on the transaction connection. Validation reproduced the warning in Prisma adapter and runtime frames. The current pg 8 driver queues the calls, and the local catalog and integration tests passed. Keep the existing lockfile for submission and re-run the catalog checks before adopting pg 9 or changing Prisma's relation loading. This warning needs remediation before a pg 9 upgrade. [Prisma issue](https://github.com/prisma/orm/issues/30925) · [node-postgres queue change](https://github.com/brianc/node-postgres/issues/3633)
