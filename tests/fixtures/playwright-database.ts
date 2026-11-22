export function playwrightDatabaseEnv() {
  const value = process.env.PLAYWRIGHT_DATABASE_URL;
  const url = URL.parse(value ?? "");
  if (!value || !url || !["postgres:", "postgresql:"].includes(url.protocol)
    || url.hostname !== "127.0.0.1" || !url.port || url.pathname !== "/ryhme_test"
    || url.search || url.hash) {
    throw new Error("Set PLAYWRIGHT_DATABASE_URL to the seeded loopback PostgreSQL fixture at 127.0.0.1:<port>/ryhme_test.");
  }
  return { DATABASE_URL: value, DIRECT_URL: value, VERCEL: "", VERCEL_ENV: "", VERCEL_TARGET_ENV: "" };
}
