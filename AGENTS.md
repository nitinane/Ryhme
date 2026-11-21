# AGENTS.md — Codex instructions for OneAtlas

## Mission and priority
Build OneAtlas for **2026-11-23 19:00 IST** hard deadline. P0 six mandatory modules + deploy + GitHub + Loom preparation before P1/P2. Read README and documents 01–09 before implementation. Work autonomously within constraints; report at milestone checkpoints.

## Mandatory engineering rules
1. Use Next.js App Router, TypeScript, Tailwind, Prisma, Neon PostgreSQL, modular monolith. Avoid microservices, Redis, vector DB, and extra frameworks without approval.
2. Implement vertical slices: frontend + backend + DB + validation + tests together. Never build a mock-only facade and claim completion.
3. Source all catalog facts. No invented benchmark results, prices, source URLs, release dates, or provider availability. Mark unknowns explicitly.
4. Keep model family, version, lab, provider offering and benchmark definition separate.
5. All API input Zod-validated; authorization server-side; user-owned records scoped by session; secrets server-side.
6. Groq only interprets validated filters or explains deterministic sourced recommendations. No generated SQL; graceful fallback.
7. Use decimal-safe cost arithmetic, explicit currency and per-million-token units; missing price => unknown.
8. Keep public P0 functional when Groq/OAuth/upstream ingestion fails.
9. No paid service or destructive command without explicit user approval. Never reset production DB or run unreviewed production migrations.
10. Prefer built-in Next.js/React/PostgreSQL primitives over new dependencies. Document why any extra dependency is needed.
11. Run lint, typecheck, tests and build before claiming success; state what was not run. Commit logical increments with descriptive messages.
12. Verify actual package/library versions and official APIs before coding assumptions; don't blindly copy documentation sketches.

## Milestone execution
M0 foundation/seed -> M1 discovery/detail/compare -> M2 rankings/ecosystem/responsive -> M3 CI/deploy/README/Loom -> optional P1/P2. After each milestone report: files changed, tests run and outputs, current deploy status, blockers, risks, next steps. Stop and ask for architectural pivot, secrets, production migration or payment authorization.

## Time-box rule
If the deadline is at risk: freeze P1/P2, reduce nonessential polish/catalog breadth, fix P0 and submission blockers. Do not hide broken mandatory features behind optimistic wording.

## Definition of done
Real DB integration, responsive UI, accessible primary interaction, loading/empty/error states, security checks, verified test evidence and docs. Never invent test results, screenshots, URLs or Loom completion.
