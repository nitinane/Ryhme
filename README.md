# OneAtlas — Execution-ready engineering pack

**Mission:** Ship a credible AI model discovery and intelligence platform for a Full Stack Engineer internship assessment.
**Hard submission deadline:** **2026-11-23 19:00 IST (Asia/Kolkata)**. Treat this as the submission cutoff; aim to finish deploy and verification earlier. **As-of planning date:** 2026-11-20.

## Non-negotiable submission
1. Six working modules: model discovery; model details; model comparison; benchmark rankings; labs/providers; responsive product experience.
2. Public Vercel URL, accessible GitHub repository, Loom demo URL.
3. Real PostgreSQL-backed data and working API routes; do not pass mock-only UI off as complete.
4. Reliable seeded dataset; no invented benchmark values, prices, source URLs, or verification claims.

## Chosen architecture
Next.js App Router + React + TypeScript + Tailwind; Next.js route handlers and server components; Prisma + Neon PostgreSQL; Auth.js Google OAuth; Groq for advisor, query interpretation and optional playground; OpenRouter + Hugging Face + official documentation + curated sourced benchmarks; GitHub Actions + Vercel. Modular monolith, no Redis, microservices, or separate search infrastructure.

## Run the M0 foundation

Use Node.js 24, npm, and an isolated PostgreSQL development database (Neon for hosted development). Run the commands from this directory.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Set `DATABASE_URL` in `.env.local`. For Neon, use the pooled connection for the app and put the direct connection in `DIRECT_URL` for migrations. Prisma CLI and Next.js both load `.env.local`. Keep production credentials in the Vercel production scope and preview credentials in a separate development scope.

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The homepage reads the catalog size from PostgreSQL. `GET /api/health` returns 200 when the catalog table can be queried and a safe 503 otherwise.

The seed contains three GPT-4.1 snapshots with [publisher-reported launch prices and benchmark results](https://openai.com/index/gpt-4-1/). Provider listings are dated documentation observations. Repeated seeding preserves existing records and historical observations.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. For integration and mobile smoke, use a fresh development database, run the migration and seed twice, run `npm exec -- tsx tests/seed-check.ts` after each seed, then run `npm exec -- playwright install chromium` and `npm run test:e2e` after the build. GitHub Actions runs the same checks against disposable PostgreSQL. Vercel can use its Next.js preset and `npm run build`; apply reviewed migrations as a separate controlled step.

## Engineering documents
- `01_PRD.md`: product outcomes and scope
- `02_TRD.md`: system design and performance
- `03_APP_FLOW.md`: routes and UX state flows
- `04_BACKEND_AND_SCHEMA.md`: relational model and migrations
- `05_API_INTEGRATION_AND_SPEC.md`: API contracts, sources, OpenAPI
- `06_SECURITY_AND_ACCESS.md`: authorization, limits, privacy
- `07_AI_GUARDRAILS_AND_RULES.md`: safe grounded AI
- `08_FEATURE_TICKETS.md`: milestones and acceptance criteria
- `09_DEPLOYMENT_AND_TESTING_RUNBOOK.md`: reproducible build, deployment, tests
- `AGENTS.md`: standing Codex engineering rules
- `CODEX_START_PROMPT.md`: copy into Codex to start
- `SUBMISSION_CHECKLIST.md`: final evidence and links
- `tickets/`: independently executable milestone tickets

## Definition of complete
A feature is complete only when its UI, persisted backend behavior, loading/error/empty states, authorization (if needed), and automated or reproducible verification are present. A deployed URL and recorded Loom link are not automatically created by these documents. Codex must report real outcomes and ask for credentials/authorization when required.

## Priorities
**P0:** six mandatory modules, deploy, repo, Loom, quality checks. **P1:** advisor, workspace, ingestion automation, admin, analytics, corrections, expanded data intelligence. **P2:** Groq playground and deeper polish. The P0 product must ship even if P1/P2 remain unbuilt.
