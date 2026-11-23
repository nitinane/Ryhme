# Rhyme

**Mission:** Ship a credible AI model discovery and intelligence platform for a Full Stack Engineer internship assessment.
**Hard submission deadline:** **2026-11-23 19:00 IST (Asia/Kolkata)**. Treat this as the submission cutoff; aim to finish deploy and verification earlier. **As-of planning date:** 2026-11-20.

## Non-negotiable submission
1. Six working modules: model discovery; model details; model comparison; benchmark rankings; labs/providers; responsive product experience.
2. Public Vercel URL, accessible GitHub repository, Loom demo URL.
3. Real PostgreSQL-backed data and working API routes; do not pass mock-only UI off as complete.
4. Reliable seeded dataset; no invented benchmark values, prices, source URLs, or verification claims.

## Architecture

Rhyme is a Next.js App Router application using React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL. Server-rendered pages and JSON API route handlers use the same database services. Client components handle search, comparison selection, and chart interactions. GitHub Actions runs the test suite. The repository has a manual Vercel Preview configuration.

## Run Rhyme locally

Use Node.js 24. Run commands from the application repository, the directory containing `package.json`.

### Existing 596-model catalog

On the rehearsal machine, PostgreSQL is already listening on loopback port `55493`. These PowerShell variables point the current shell to the local catalog even if `.env.local` contains hosted settings. If dependencies are missing, run `npm.cmd ci` first.

```powershell
$env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55493/ryhme_local_catalog'
$env:DIRECT_URL = $env:DATABASE_URL
npm.cmd run db:generate
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Open [the local model catalog](http://localhost:3000/models). Expect **596 model versions**. A new PowerShell tab can check the app with `Invoke-RestMethod http://localhost:3000/api/health`. Press **Ctrl+C** in the app terminal to stop Next.js.

For a production-mode localhost preview, set the same two variables and run:

```powershell
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3000
```

### Fresh local database

Create an empty PostgreSQL database on your machine. In a new shell, copy `.env.example` to `.env.local` if the file does not already exist and set both URLs to the new local database. Then initialize it with the checked-in migrations and seed.

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

The offline seed contains four model versions across two labs and two providers. It includes three GPT-4.1 snapshots with [publisher-reported launch prices and benchmark results](https://openai.com/index/gpt-4-1/) and Gemma 3 27B Instruct with a [Google DeepMind model card](https://huggingface.co/google/gemma-3-27b-it) and an [OpenRouter listing observation](https://openrouter.ai/api/v1/models/google/gemma-3-27b-it/endpoints). Repeated seeding preserves existing records and historical observations.

## How the workflow fits together

1. **Discover.** Open `/models`, search by model name or family, and narrow the list by category, publisher, provider, or evidence. PostgreSQL returns a page and the total matching count. Category charts use the full filtered set and the URL preserves the active filters.
2. **Inspect and compare.** Open a model for specifications, offerings, historical prices, and source links. Select two to four versions to compare. Choose documented offerings in the estimator and enter a token workload to calculate costs from those historical rates.
3. **Evaluate.** Open `/rankings` and select a benchmark and cohort. Rankings use verified results from the same evaluation. The audited local catalog has eight active scores across three benchmarks. Models without comparable evidence remain discoverable and unranked.
4. **Follow the ecosystem.** Browse `/labs` for publishers and model families, then `/providers` for services and their offerings.

Catalog metadata and dated observations are stored in PostgreSQL. Prisma services read them for pages and APIs. Source records link model metadata, offering prices, and benchmark results back to their evidence. Startup, search, and comparison read the configured database. Catalog refreshes and migrations run separately.

## Checks and hosting

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. For browser tests, create a fresh local PostgreSQL 17 database named `ryhme_test`. In a dedicated shell, set `PLAYWRIGHT_DATABASE_URL` to that database's URL at `127.0.0.1` with an explicit port, and set both `DATABASE_URL` and `DIRECT_URL` to the same local URL before running these commands.

```sh
npm run db:migrate
npm run db:seed
npm run build
npm exec -- playwright install chromium
npm run test:e2e
```

Playwright uses `PLAYWRIGHT_DATABASE_URL` for its own app servers and verifies the checked-in four-model seed before running tests. GitHub Actions uses the same fixture and also checks that running the seed twice preserves the dataset. Vercel can use its Next.js preset and `npm run build`. Apply reviewed migrations as a separate controlled step.

For hosting, follow the [Preview handoff](09_DEPLOYMENT_AND_TESTING_RUNBOOK.md#hosted-verification-handoff). Use a pooled runtime URL in Preview and a separate direct connection for approved migrations.

For an approved Vercel Production deployment, set `RYHME_ALLOW_PRODUCTION_DB=1` in Production only and set `DATABASE_URL` to the verified catalog's pooled SELECT-only connection. Keep system environment variables enabled. Use a fresh deployment to apply the settings, then verify `/api/health`, the catalog count, and populated leaderboards.

## Catalog and comparison

Open `/models` or press Ctrl+K (Cmd+K on macOS). PostgreSQL indexes support model-name and slug term search and structured filters. The catalog URL preserves filters, sort, and page. For example, `/models?q=GPT-4.1&capability=tool-calling&sort=context&limit=1`.

Select two to four models in the catalog or on their detail pages. The comparison URL stores the ordered model IDs. Prices are historical observations. The USD price filter and sort use the lowest latest observed input rate among documented listed offerings, scoped to the selected provider when applicable. Retired offerings remain visible as historical records. The estimator uses an individual offering’s latest recorded price and labels the date and currency.

The public JSON endpoints are `GET /api/models`, `GET /api/models/:slug`, `GET /api/compare?modelId=...&modelId=...`, and `POST /api/compare/cost`. The cost body contains `offeringIds`, `inputTokens`, and `outputTokens`. Numeric amounts are decimal strings and missing amounts are `null`.

## Benchmarks and ecosystem

Open `/rankings` to browse SWE-bench Verified, GPQA Diamond, and AIME 2024. Results rank within a single published evaluation, with shared ranks for tied scores. Rows with missing comparable scores are counted separately. The launch report supplies a publication date. Evaluation dates are shown as unknown when the publisher leaves them unspecified.

`/labs` groups versions by the organization that publishes them. `/providers` searches API providers by provider or model name and filters by dated availability and model capability. The directories link to model details and expose `GET /api/labs`, `GET /api/labs/:slug`, `GET /api/providers`, `GET /api/providers/:slug`, and `GET /api/rankings`.

For an opt-in refresh of the OpenRouter listing, configure the seeded development database and run `npm run db:ingest:openrouter`. It makes one unauthenticated metadata GET with an eight-second timeout. It checks the exact allowlisted model ID and only updates a matching positive listing observation. OpenRouter routes can quote different prices. The gateway-level cost remains unknown. The seed uses checked-in source observations.

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

## M10 local intelligence refresh

Run `npm run db:refresh:intelligence -- catalog <source>` against a migrated disposable PostgreSQL database. Set `RYHME_INTELLIGENCE_DATABASE_URL` to a loopback connection on an explicit port with a database name beginning with `ryhme_`. The command does not use the app's database URL as a fallback.

| Source | Settings | Verified fields and limits |
|---|---|---|
| `openai` | `OPENAI_API_KEY` | Dated snapshot IDs, direct API listing. Undated IDs remain unresolved aliases unless a source establishes their target. API record creation is not used as a release date. |
| `anthropic` | `ANTHROPIC_API_KEY` | Exact dated or documented immutable Claude IDs, display name, published model line, lifecycle, token limits, documented modalities and supported capabilities. Older moving aliases remain unresolved. |
| `gemini` | `GEMINI_API_KEY` | Gemini resources with an explicit version in their resource ID, base-model identity, display name and provider input/output limits. Input limit is stored separately from total context. |
| `qwen` | `DASHSCOPE_API_KEY`, `QWEN_WORKSPACE_HOST` | Qwen Model Studio exact snapshots and explicit alias targets, published dates, modalities, capabilities and token limits. Imports flat standard token prices in CNY from the Beijing workspace, where the API identifies a single default tier and a per-million-token input/output pair. |
| `huggingface` | `HF_PUBLISHER`, `HF_LAB_SLUG`, `HF_LAB_NAME`, `HF_LAB_WEBSITE`, optional `HF_TOKEN` | Public repositories from an operator-reviewed official publisher, pinned to repository SHA, with declared model-card license where supplied. A repository SHA identifies the observed repository revision. It does not prove a new weight revision, a token context limit, or hosted availability. |

Metadata stays unknown when the endpoint omits it. Catalog polling preserves previously recorded values in a conflict and records source evidence for accepted fields. Configure one account or workspace per provider adapter so observations have a consistent scope. Full results are committed atomically, repeated snapshots are idempotent, and moving aliases retain their observed targets. Pagination errors, suspicious coverage drops, and upstream failures keep the prior catalog. Absence in these feeds does not establish retirement. The existing OpenRouter sync remains separate.

Run `npm run db:refresh:intelligence -- benchmark bfcl` to find the newest dated Berkeley archive at an immutable Git commit and ingest licensed BFCL V4 aggregate scores. This adapter matches explicitly dated OpenAI and Anthropic checkpoints and keeps native and prompted cohorts separate. V3 and the previously reviewed Epoch AI slice remain available through their existing commands. `benchmark epoch` imports that pinned Epoch slice. It is not a poll of every Epoch result.

For another reviewed Epoch or BFCL release, use `npm run db:refresh:intelligence -- benchmark <epoch|bfcl> <export.json> <sha256>`. The JSON is `{ "version": "<source revision>", "feed": { "source": ..., "benchmarks": [...], "evidence": [...] } }` using the existing benchmark feed shape. Supply exact checkpoint triples `{ sourceId, externalId, revision }` or reviewed catalog slugs. The checksum covers the file contents. Use the same cohort key only for identical evaluation settings. A correction must specify the active `replacesRevision` checksum, or the empty revision for legacy evidence. Corrections retain the previous observation and remove it from current rankings and comparisons. BFCL aggregates use Apache 2.0 and Epoch's own aggregates require CC BY 4.0 attribution. Approval of a source does not extend to third-party artifacts appearing in its feed.

On the homepage, an automatically featured cohort requires at least three verified versions, two represented labs, and a known evaluator relationship. Choose by coverage band (20+, 8–19, 3–7), then independent over publisher-reported evaluation, then evaluation date (publication date when evaluation date is unknown), then lab breadth, model count, and stable cohort ID. If no cohort qualifies, use the normal category default. An explicit selection takes precedence. Scores continue to be ranked within cohorts using exact stored decimals and ties.

For the M10 regression, migrate and seed a fresh `ryhme_m10_test` loopback database, build the app, then run `npm test` with `M10_TEST_DATABASE_URL` pointing to that database. The test starts a local production server on port 3103 and verifies discovery, unranked search, source provenance, added evidence, SQL ranking ties, and supersession through the actual HTTP APIs. Standard Playwright still uses its separate unchanged four-model fixture.

The two M10 migrations add source snapshots, catalog identities, provider token limits, and benchmark revision history. Apply them with the schema owner only after database-write approval. A future hosted ingestion role needs read access to source and identity tables, insert access to catalog and evidence tables, and scoped updates for sync timestamps, approved metadata, offerings, and `BenchmarkResult.supersededAt`. Keep runtime reads separate from migration and refresh credentials. The existing OpenRouter role already reads `SourceObservation` for its limited catalog writes. No workflow runs the new refresh command.
