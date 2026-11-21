# 04 — Backend, Database and Prisma Schema Specification

## 1. Modeling rules
- Model family != model version != serving provider offering.
- Every benchmark result references a benchmark definition and a model version.
- Prices belong to provider offerings and are timestamped; unknown prices are nullable.
- External source provenance belongs to observations/records, not a global verified flag.
- Auth.js tables follow the adapter's actual supported schema; avoid guessing field compatibility.

## 2. Core entities
| Entity | Important fields | Relationships / constraints |
|---|---|---|
| Lab | id, slug unique, name, website?, description? | has many families |
| ModelFamily | id, labId, slug unique, name, description? | belongs to Lab; versions |
| ModelVersion | id, familyId, slug unique, canonicalName, releaseDate?, lifecycle, contextTokens?, modalities JSON/relations, license?, openWeights?, createdAt, updatedAt | belongs to family; offerings/results; distinct stable external IDs |
| Provider | id, slug unique, name, website? | has many offerings |
| Offering | id, providerId, modelVersionId, externalModelId, availabilityStatus, contextOverride?, observedAt, sourceId | unique(providerId,externalModelId); optional price snapshots |
| PriceObservation | id, offeringId, currency, inputPerMillion Decimal?, outputPerMillion Decimal?, observedAt, sourceId | immutable snapshots; current derived by newest valid observation |
| Benchmark | id, slug unique, category, metricName, unit, direction, methodology, version?, sourceId | results |
| BenchmarkResult | id, benchmarkId, modelVersionId, score Decimal, evaluatedAt?, sourceId, methodologyVersion?, verifiedStatus | unique by source/evaluation key; avoid duplicate double-counting |
| DataSource | id, name, homepage, sourceType, trustPolicy | provenance |
| SourceObservation | id, sourceId, entityType, entityId, field?, sourceUrl, observedAt, verificationStatus, rawChecksum? | evidence and freshness |
| IngestionRun | id, sourceId, startedAt, finishedAt?, status, fetched, inserted, updated, skipped, errorSummary? | admin visibility |
| User | Auth.js-compatible id, email?, name?, image?, role | saved items and settings |
| Bookmark | userId, modelVersionId, createdAt | unique(userId,modelVersionId) |
| SavedComparison | id, userId, title?, modelIds JSON or join table, createdAt | user ownership; 2–4 IDs |
| UserPreference | userId unique, preferredProviderIds, workload defaults | validated settings |
| CorrectionReport | id, modelVersionId?, reporterId?, category, description, status, createdAt, reviewedBy? | admin moderation |
| AnalyticsAggregate | date, eventType, targetId?, count | aggregated non-sensitive counters |

## 3. Prisma implementation sketch (adapt to installed Prisma/Auth.js versions)
```prisma
enum Lifecycle { ACTIVE DEPRECATED RETIRED UNKNOWN }
enum VerificationStatus { VERIFIED UNVERIFIED CONFLICTED }
enum IngestionStatus { RUNNING SUCCEEDED PARTIAL FAILED }

model Lab {
  id String @id @default(cuid())
  slug String @unique
  name String
  website String?
  families ModelFamily[]
}
model ModelFamily {
  id String @id @default(cuid())
  slug String @unique
  name String
  labId String
  lab Lab @relation(fields: [labId], references: [id])
  versions ModelVersion[]
}
model ModelVersion {
  id String @id @default(cuid())
  slug String @unique
  canonicalName String
  familyId String
  family ModelFamily @relation(fields: [familyId], references: [id])
  lifecycle Lifecycle @default(UNKNOWN)
  releaseDate DateTime?
  contextTokens Int?
  license String?
  openWeights Boolean?
  modalities Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  offerings Offering[]
  results BenchmarkResult[]
  bookmarks Bookmark[]
  @@index([familyId, lifecycle])
}
model Provider {
  id String @id @default(cuid())
  slug String @unique
  name String
  offerings Offering[]
}
model Offering {
  id String @id @default(cuid())
  providerId String
  modelVersionId String
  externalModelId String
  observedAt DateTime
  provider Provider @relation(fields: [providerId], references: [id])
  model ModelVersion @relation(fields: [modelVersionId], references: [id])
  prices PriceObservation[]
  @@unique([providerId, externalModelId])
  @@index([modelVersionId])
}
model PriceObservation {
  id String @id @default(cuid())
  offeringId String
  offering Offering @relation(fields: [offeringId], references: [id])
  currency String
  inputPerMillion Decimal? @db.Decimal(18, 8)
  outputPerMillion Decimal? @db.Decimal(18, 8)
  observedAt DateTime
  sourceUrl String?
  @@index([offeringId, observedAt])
}
model Benchmark {
  id String @id @default(cuid())
  slug String @unique
  category String
  metricName String
  unit String
  direction String
  methodology String
  sourceUrl String
  results BenchmarkResult[]
}
model BenchmarkResult {
  id String @id @default(cuid())
  benchmarkId String
  modelVersionId String
  score Decimal @db.Decimal(18, 8)
  evaluatedAt DateTime?
  sourceUrl String
  verification VerificationStatus @default(UNVERIFIED)
  benchmark Benchmark @relation(fields: [benchmarkId], references: [id])
  model ModelVersion @relation(fields: [modelVersionId], references: [id])
  @@index([benchmarkId, score])
  @@index([modelVersionId])
}
```
**This is an implementation sketch, not a drop-in complete schema.** Add required Auth.js adapter tables and remaining entities/migration indexes using current library APIs. Never represent absent data as an invented default. Check generated Prisma client and migration SQL.

## 4. Database integrity
- Unique slugs and external IDs; foreign keys on all relations.
- `onDelete` policy: restrict for sourced catalog relations; cascade only for clearly user-owned join records when appropriate.
- Validate nonnegative token limits/prices, valid URLs and ISO dates in Zod/service layer; add database CHECK constraints in migrations where useful.
- Keep original source IDs; avoid collapsing distinct model versions with similar names.
- Source observations and price history append-only; version metadata updates audited through ingestion logs.

## 5. Search indexing
Prisma migrations can include hand-written SQL for `tsvector`, GIN indexes, `pg_trgm` extension where supported. Index frequently used filters. Parameterize raw queries. Benchmark `EXPLAIN ANALYZE` with representative seed volume before adding indexes indiscriminately.

## 6. Migration and seed rules
`prisma migrate dev` in development; `prisma migrate deploy` in controlled production step. Never `db push` as a substitute for reviewed production migrations. Seed script must be idempotent, deterministic and sourced; use stable identifiers. Demo fixtures must be explicitly labeled fixtures if not independently verified. Test migrations against a disposable database before production.

## 7. Data ownership
User data (bookmarks, preferences, saved comparisons) is not reconstructable from external APIs and must receive stricter backup/recovery treatment. Catalog data can be re-ingested but sourced observations and corrections should still be preserved.
