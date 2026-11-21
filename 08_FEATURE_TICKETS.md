# 08 — Feature Tickets and Delivery Milestones

## 1. Critical-path schedule (IST)
**Deadline:** Mon **Nov 23, 2026 at 19:00 IST**. Start immediately. Suggested targets are planning goals, not guarantees:
- **Nov 20:** repository foundation, DB schema, verified seed, CI, Vercel/Neon connectivity.
- **Nov 21:** P0 discovery, model details, comparison.
- **Nov 22:** P0 rankings, labs/providers, responsive polish; deploy and run E2E.
- **Nov 23 morning/early afternoon:** production smoke, fix blockers, README, Loom, final submission. Reserve buffer; do not begin risky optional work.

## 2. Definition of done for every ticket
Implementation + data wiring + validation + loading/empty/error states + responsive keyboard interaction + tests + docs as needed. Run `lint`, `typecheck`, `test`, `build` and targeted E2E. Commit only verified results. Report blockers and exact commands.

## 3. Priority map
| ID | Priority | Ticket | Depends on | Acceptance |
|---|---|---|---|---|
| F00 | P0 | Scaffold, config, CI, Vercel/Neon | none | app builds, DB connects, CI green |
| F01 | P0 | Prisma schema + source-attributed seed | F00 | migrations and repeatable seed pass |
| F02 | P0 | Discovery/search/filter/sort | F01 | real DB results, URL state, pagination |
| F03 | P0 | Model detail/version/offering | F01 | sourced detail page and 404 |
| F04 | P0 | Comparison + price calculator | F02,F03 | 2–4 models, correct decimal math, share link |
| F05 | P0 | Benchmark rankings | F01 | methodology-aware category rankings |
| F06 | P0 | Labs and providers | F01 | distinct entity directories and details |
| F07 | P0 | Responsive/accessibility/SEO baseline | F02–F06 | keyboard/mobile workflows and metadata |
| F08 | P0 | CI, integration/E2E, production deploy | F00–F07 | working Vercel URL and smoke evidence |
| F09 | P0 | GitHub README + Loom + submission | F08 | working links and complete checklist |
| F10 | P1 | Groq advisor/search interpretation | F02,F04 | deterministic fallback and source grounding |
| F11 | P1 | Auth.js + developer workspace | F01 | owner-isolated bookmarks/comparisons |
| F12 | P1 | Incremental ingestion + admin | F01 | safe upserts, run logs, protected trigger |
| F13 | P1 | Correction reports + analytics | F11,F12 | moderated reports, aggregate-only counts |
| F14 | P1 | OpenAPI interactive reference | API contracts | spec validates, examples match |
| F15 | P2 | Groq playground | F10 | allowlisted model execution, usage safeguards |

## 4. Cutline policy
Do not start F10–F15 while P0 acceptance or submission deliverables remain at risk. Any unfinished optional feature must be hidden/flagged off and not represented as complete. If time is short, shrink catalog breadth before sacrificing correctness of mandatory modules.

## 5. Milestone checkpoints for Codex
After F00/F01, after F02–F04, after F05–F07, after F08/F09: report completed files, acceptance evidence, test results, deploy status, blockers, and next steps. Ask approval for destructive changes, paid services, major architecture pivots, or credential-sensitive operations.

## 6. Evidence ledger
For each ticket store `status` (todo/in progress/verified/blocked), commit SHA, test command, outcome, screenshot or URL if applicable, and known limitation. Never write 'passed' unless actually run.

## 7. Ticket files
See `tickets/` for task-by-task execution instructions. The tickets are designed for sequential Codex execution; independent tickets may be parallelized only if migration/file conflicts are controlled.
