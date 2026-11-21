# Ryhme — Execution-ready engineering pack

**Mission:** Ship a credible AI model discovery and intelligence platform for a Full Stack Engineer internship assessment.
**Hard submission deadline:** **2026-11-23 19:00 IST (Asia/Kolkata)**. Treat this as the submission cutoff; aim to finish deploy and verification earlier. **As-of planning date:** 2026-11-20.

## Non-negotiable submission
1. Six working modules: model discovery; model details; model comparison; benchmark rankings; labs/providers; responsive product experience.
2. Public Vercel URL, accessible GitHub repository, Loom demo URL.
3. Real PostgreSQL-backed data and working API routes; do not pass mock-only UI off as complete.
4. Reliable seeded dataset; no invented benchmark values, prices, source URLs, or verification claims.

## Chosen architecture
Next.js App Router + React + TypeScript + Tailwind; Next.js route handlers and server components; Prisma + Neon PostgreSQL; Auth.js Google OAuth; Groq for advisor, query interpretation and optional playground; OpenRouter + Hugging Face + official documentation + curated sourced benchmarks; GitHub Actions + Vercel. Modular monolith, no Redis, microservices, or separate search infrastructure.

## Run Ryhme locally

Use Node.js 24, npm, and an isolated PostgreSQL development database (Neon for hosted development). Run the commands from this directory.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Set `DATABASE_URL` in `.env.local`. For Neon, use the pooled connection for the app and put the direct connection in `DIRECT_URL` for migrations. Prisma CLI and Next.js both load `.env.local`. Follow the [hosted handoff](09_DEPLOYMENT_AND_TESTING_RUNBOOK.md#hosted-verification-handoff) to verify an isolated Neon target before approved writes and scope the URL to Vercel Preview.

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The homepage reads the catalog size from PostgreSQL. `GET /api/health` returns 200 when the catalog table can be queried and a safe 503 otherwise.

The offline seed contains four model versions across two labs and two providers. It includes three GPT-4.1 snapshots with [publisher-reported launch prices and benchmark results](https://openai.com/index/gpt-4-1/) and Gemma 3 27B Instruct with a [Google DeepMind model card](https://huggingface.co/google/gemma-3-27b-it) and an [OpenRouter listing observation](https://openrouter.ai/api/v1/models/google/gemma-3-27b-it/endpoints). Repeated seeding preserves existing records and historical observations.

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. For integration and mobile smoke, use a fresh development database, run the migration and seed twice, run `npm exec -- tsx tests/seed-check.ts` after each seed, then run `npm exec -- playwright install chromium` and `npm run test:e2e` after the build. GitHub Actions runs the same checks against disposable PostgreSQL. Vercel can use its Next.js preset and `npm run build`; apply reviewed migrations as a separate controlled step.

## Catalog and comparison

Open `/models` or press Ctrl+K (Cmd+K on macOS). PostgreSQL indexes support model-name and slug term search and structured filters. The catalog URL preserves filters, sort, and page. For example, `/models?q=GPT-4.1&capability=tool-calling&sort=context&limit=1`.

Select two to four models in the catalog or on their detail pages. The comparison URL stores the ordered model IDs. Prices are historical observations. The USD price filter and sort use the lowest latest observed input rate among documented listed offerings, scoped to the selected provider when applicable. Retired offerings remain visible as historical records. The estimator uses an individual offering’s latest recorded price and labels the date and currency.

The public JSON endpoints are `GET /api/models`, `GET /api/models/:slug`, `GET /api/compare?modelId=...&modelId=...`, and `POST /api/compare/cost`. The cost body contains `offeringIds`, `inputTokens`, and `outputTokens`. Numeric amounts are decimal strings and missing amounts are `null`.

## Benchmarks and ecosystem

Open `/rankings` to browse SWE-bench Verified, GPQA Diamond, and AIME 2024. Results rank within a single published evaluation, with shared ranks for tied scores. Rows with missing comparable scores are counted separately. The launch report supplies a publication date. Evaluation dates are shown as unknown when the publisher leaves them unspecified.

`/labs` groups versions by the organization that publishes them. `/providers` searches API providers by provider or model name and filters by dated availability and model capability. The directories link to model details and expose `GET /api/labs`, `GET /api/labs/:slug`, `GET /api/providers`, `GET /api/providers/:slug`, and `GET /api/rankings`.

For an opt-in refresh of the OpenRouter listing, configure the seeded development database and run `npm run db:ingest:openrouter`. It makes one unauthenticated metadata GET with an eight-second timeout. It checks the exact allowlisted model ID and only updates a matching positive listing observation. OpenRouter routes can quote different prices. The gateway-level cost remains unknown. App startup, build, tests, and seeding use the checked-in snapshot.

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
