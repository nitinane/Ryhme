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

For broad catalog sync, run `npm run db:sync:openrouter` to preview against the verified Neon development branch in a read-only transaction. Only after approval, run `npm run db:sync:openrouter -- --apply <preview-hash>`. The hash binds the exact UTC observation day, rows, conflicts, and planned writes. A changed plan requires a new preview. Sync uses a serializable transaction and the existing schema.

The importer uses the [OpenRouter public catalog](https://openrouter.ai/docs/api_reference/models) across output modalities. It deduplicates checkpoints by canonical slug, preserves each routable offering ID, and reuses exact reviewed seed identities. Author namespaces and conservative family mappings provide grouping when creator metadata has not been independently verified. Imported model metadata is an initial source observation. Listing freshness and daily base USD text-token prices are tracked separately. Non-token prices, lifecycle, release dates, licensing, and benchmarks are left unknown. Missing listings and conflicting identity mappings leave existing data intact. Review [OpenRouter terms](https://openrouter.ai/terms) before public redistribution.

### Import independent benchmark evidence locally

Set `BENCHMARK_DATABASE_URL` to a migrated, seeded loopback PostgreSQL database. Run `npm run db:ingest:bfcl` for the read-only preview, then `npm run db:ingest:bfcl -- --apply` to import locally. The importer skips unmatched exact identities, records source checksums and observation times, and rejects conflicting evidence under an existing evaluation identity. To run the PostgreSQL ingestion regression, set `BENCHMARK_TEST_DATABASE_URL` to a fresh seeded loopback database named `ryhme_m6_test` and run `npm test`.

The adapter reads two aggregate columns from the [March 17, 2025 BFCL V3 archive](https://github.com/HuanzhiMao/BFCL-Result/blob/cadd76a8dc62984e7bf15ecaf358f070bae745cc/2025-03-17/score/data_overall.csv), attributed to the Berkeley Function Calling Leaderboard under the [Apache 2.0 license](https://github.com/HuanzhiMao/BFCL-Result/blob/cadd76a8dc62984e7bf15ecaf358f070bae745cc/LICENSE). The archive date is a publication date. Individual evaluation dates are unknown. Native and prompt-based runs stay separate. The long-context results measure tool use under the BFCL workload.

The existing GPT-4.1 launch results are publisher-reported. Hugging Face leaderboard entries require checks of the individual artifact, evaluation settings, model revision, and redistribution terms before addition. Empty categories remain visible until they have comparable evidence. Overall intelligence is not computed.

#### M7 benchmark coverage audit

Run `npm run db:ingest:gemma3` for a read-only preview or pass `-- --apply` to import into the configured loopback database. The importer requires at least two exact catalog matches per benchmark, evaluation identity, and evaluation date. Missing dates can share a cohort only when the source adapter identifies a common evaluation.

| Category | Reviewed evidence | Decision |
| --- | --- | --- |
| Vision and multimodal | [Gemma 3 model card](https://github.com/google-gemma/docs/blob/9db9d497e046d34c68925f80a0672b3d1fe690dd/docs/models/gemma-3/index.md#multimodal), [MMMU-Pro paper](https://arxiv.org/html/2409.02813v2) | Import original MMMU validation accuracy for the Gemma 3 IT 4B, 12B, and 27B cohort. MMMU-Pro uses different task settings and stays separate. |
| General knowledge | [Gemma 3 model card](https://github.com/google-gemma/docs/blob/9db9d497e046d34c68925f80a0672b3d1fe690dd/docs/models/gemma-3/index.md#stem-and-code), [MMLU-Pro repository](https://github.com/TIGER-AI-Lab/MMLU-Pro/tree/f418b116db00b065c2aea046518d8fcf74d39872) | Import reported zero-shot IT MMLU-Pro accuracy. The upstream archives reviewed contain per-question predictions; their scores are outside this cohort. |
| Creative writing | [EQ-Bench Creative Writing V3](https://github.com/EQ-bench/creative-writing-bench) | Leave empty. The published leaderboard and archives need further review of revision-specific model identities, judging settings, and redistribution terms. |
| Speed and latency | [OpenBenchmarks inference results](https://github.com/openbenchmarks-labs/inference), [Microsoft isolation study](https://arxiv.org/abs/2610.09778) | Leave empty. The provider study compares one checkpoint across providers; the fixed-stack study needs a verified mapping for its hardware, runtime, and model artifacts. |
| Cost efficiency | [OpenRouter pricing](https://openrouter.ai/pricing) | Leave empty. Gateway prices are price observations. A comparable efficiency score needs an evaluated workload and a consistent quality and cost measurement. |

The [pinned model card license](https://github.com/google-gemma/docs/blob/9db9d497e046d34c68925f80a0672b3d1fe690dd/LICENSE) is Apache 2.0. Its two imported tables are publisher-reported and provide no individual evaluation dates. The MMMU shot count and dataset artifact revisions are unreported. The source link records the immutable documentation revision.

#### M8 cross-model coverage audit and Epoch import

Read-only Neon baseline before selecting new sources: 592 model versions, 7 definitions, 28 verified scores in 9 cohorts, and 583 models without any verified benchmark evidence.

| Category / evaluation | Evaluated models | Families | Labs |
| --- | ---: | ---: | ---: |
| Coding / OpenAI SWE-bench Verified | 2 | 1 | 1 |
| Reasoning / OpenAI GPQA Diamond | 3 | 1 | 1 |
| Mathematics / OpenAI AIME 2024 | 3 | 1 | 1 |
| Vision / Gemma MMMU validation | 3 | 1 | 1 |
| General knowledge / Gemma MMLU-Pro | 3 | 1 | 1 |
| Instruction following and long context / BFCL native, each | 3 | 2 | 2 |
| Instruction following and long context / BFCL prompted, each | 4 | 3 | 3 |
| Creative writing, speed and latency, and cost efficiency | 0 | 0 | 0 |

The models with verified scores were GPT-4.1, GPT-4.1 mini, GPT-4.1 nano, GPT-4o (2024-11-20), GPT-4o-mini (2024-07-18), Qwen2.5 72B Instruct, and Gemma 3 IT 4B, 12B, and 27B. All other catalog versions lacked verified scores. Match coverage depends on reviewed exact version mappings. Display names, model families, and mutable API aliases alone are insufficient.

**Selected source.** Epoch AI, [Capabilities and benchmarking](https://epoch.ai/benchmarks), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The selected aggregate CSVs are pinned by the original [archive](https://epoch.ai/data/benchmark_data.zip) SHA-256 `1f488dfd7e8f8a202efc16e792da93c35ebac431f5ee73f55b9d86b052302cf2`. The checked-in extract filters two same-day batches to exact mapped checkpoints. Scores retain the source's mean accuracy, converted from a fraction to percentage points to fit existing decimal storage. The run date is the UTC date of Epoch's `Started at` field. Release dates are separate. Rows retain Epoch's per-run log viewer link.

- [GPQA Diamond](https://epoch.ai/benchmarks/gpqa-diamond), `gpqa_diamond.csv`, runs started 2025-01-27. Eight mapped checkpoints. The remaining 48 same-day rows were excluded without reviewed exact mappings.
- [OTIS Mock AIME 2024-2025](https://epoch.ai/benchmarks/otis-mock-aime-2024-2025), `otis_mock_aime_2024_2025.csv`, runs started 2025-02-25. Eight mapped checkpoints. The remaining 24 same-day rows were excluded without reviewed exact mappings.

The [official SWE-bench experiment archive](https://github.com/SWE-bench/experiments) includes different agent setups, and the examined Epoch SWE-bench same-day selections lack three verified exact cross-lab matches. [MMMU-Pro](https://arxiv.org/html/2409.02813v2) has distinct task and prompting settings, and the reviewed matching checkpoints were too narrow for a new cross-lab cohort. [SimpleQA Verified](https://epoch.ai/benchmarks/simple-qa-verified) was reviewed for general knowledge. Its same-day exact matches did not yet establish sufficiently broad cross-lab coverage. These existing categories remain served by their prior cohorts.

Set `BENCHMARK_DATABASE_URL` to a migrated loopback catalog database. Run `npm run db:ingest:epoch` for a preview and `npm run db:ingest:epoch -- --apply` for a local import. To reproduce the checked-in subset, run `python scripts/extract-epoch-benchmarks.py <verified-archive.zip>`. The importer requires three exact model matches in each selected cohort. Neon writes require a separate approval.

### Activate scheduled catalog sync

The local workflow is gated by `RYHME_CATALOG_SYNC_ENABLED` and runs at 00:17, 06:17, 12:17, and 18:17 UTC. It also supports manual dispatch from `main` on `nitinane/Ryhme`. A workflow concurrency group and a PostgreSQL transaction lock prevent overlapping writes. The run stores last-seen observations and the last successful sync time. A catalog-managed listing must remain missing for at least 24 hours across usable snapshots before becoming unavailable. Large drops, duplicate identifiers, or identity conflicts suspend absence-based changes. Reappearing listings are restored. Missing price components retain their most recent known value when another component changes. The price history records gateway text-token rates and excludes other charges.

After explicit approval:

1. Revalidate the Neon `oneAtlas` development branch and review and apply the pending catalog sync migration there using the owner role. Verify existing observation dates still map to midnight UTC and check schema drift. The workflow never runs migrations.
2. Provision the dedicated non-owner `ryhme_catalog_sync` login. Apply [catalog grants](scripts/catalog-sync-grants.sql) on that database. Verify the role has no elevated memberships, benchmark writes, deletes, or schema changes. Keep the password private.
3. In `nitinane/Ryhme` Actions Secrets, configure `NEON_DEVELOPMENT_CATALOG_DIRECT_URL` for that role and direct development endpoint with `sslmode=verify-full`. The job checks endpoint, database, role, repository, branch, and trigger.
4. Push the reviewed workflow to `main` with the gate unset. Verify CI and the skipped sync job. After activation approval, set the repository Actions variable `RYHME_CATALOG_SYNC_ENABLED` to `true`, manually dispatch, and check counts and timestamps before relying on the schedule. Unset the variable to pause future jobs.

To test without Neon, use a fresh, migrated, seeded loopback database named `ryhme_test`. Grant the scheduler role the permissions in the SQL file with the database name changed to `ryhme_test`. Set `RYHME_SYNC_TEST_DATABASE_URL` to that role's loopback connection URL and run `npm test`. Integration fixtures write into the disposable database and use mocked OpenRouter snapshots.



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
