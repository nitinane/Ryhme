# 06 — Security, Access Control and Privacy

## 1. Trust boundaries
Browser input, OAuth session, external API responses, ingestion records, and Groq output are untrusted. Validate at every boundary. Secrets remain server-side; no `NEXT_PUBLIC_` prefix on secret keys.

## 2. Role/permission matrix
| Operation | Anonymous | Authenticated user | Admin |
|---|---|---|---|
| Browse/search/detail/rank/compare | Yes | Yes | Yes |
| Advisor (limited) | Yes | Yes | Yes |
| Save bookmarks/comparisons/preferences | No | Own records only | Own records only |
| Submit correction report | Rate-limited | Rate-limited | Yes |
| View admin metrics/reports | No | No | Yes |
| Trigger ingestion | No | No | Yes |
| Change roles / run migrations | No | No | Controlled operator only |

## 3. Authentication and authorization
Auth.js Google OAuth. Validate session on server for every private route/action. Admin role assigned through explicit allowlist or protected database operation, never client-supplied role. User-owned queries always constrain `userId` to authenticated principal; do not rely on UI hiding controls. Use safe redirect validation and secure cookie/session defaults.

## 4. Request security
- Zod input validation with bounded strings, arrays, numeric ranges and pagination.
- Parameterized Prisma queries; no arbitrary Groq-generated SQL or dynamic field injection.
- Rate limits: stricter for Groq/playground/admin sync, moderate for public search; implement with a deployment-compatible shared mechanism where needed (in-memory limits are not reliable across Vercel instances). If no shared store is available, use provider quotas and explicit degraded behavior rather than claim global enforcement.
- Enforce payload limits, request timeouts, safe retry policies and CSRF protection for cookie-authenticated mutations (Auth.js/framework protections plus origin checks as appropriate).
- Prevent SSRF by allowlisting outbound source domains and rejecting arbitrary user-supplied fetch URLs.
- Use security headers and strict URL sanitization for outbound links.

## 5. Privacy and analytics
Aggregate counts for page views, model views, searches, comparisons and advisor invocations. Avoid raw prompts, full search text, IP retention, sensitive OAuth profile data, and unnecessary cookies. Document analytics notice/consent requirements based on actual implementation and jurisdiction. Never expose user-specific caching across sessions.

## 6. Data reporting
Validate and rate-limit correction reports. Treat report text as untrusted and escape on display. Admin review required before changing verified catalog data. Keep minimal audit fields for report status and ingestion trigger actions.

## 7. Secrets and environment
Required/conditional vars: `DATABASE_URL`, `DIRECT_URL` if needed by Prisma, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GROQ_API_KEY`, optional OpenRouter/HF credentials, `CRON_SECRET`, `ADMIN_EMAIL_ALLOWLIST`, `NEXT_PUBLIC_APP_URL`. Exact names may vary by library version; document and validate them in `.env.example`. No real credentials in repo, docs, screenshots, CI logs, or Loom.

## 8. Threat scenarios to test
Anonymous admin access -> 401/403; user A cannot fetch/delete user B records; tampered comparison IDs rejected; prompt injection from source text does not override instructions; 429 for excessive AI calls; no sensitive stack traces; invalid redirect blocked; sync endpoint rejects unauthenticated calls; repeated sync cannot corrupt catalog; failed ingestion leaves old data intact.

## 9. Dependency and deployment security
Lockfile committed; run dependency audit and review severe findings; least-privilege GitHub Actions and Vercel environment variables; isolate preview DB; review migration SQL; no destructive commands without explicit approval.
