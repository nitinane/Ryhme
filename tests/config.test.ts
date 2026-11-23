import { describe, expect, it } from "vitest";
import { databaseConnectionString, databaseEnv } from "../src/lib/config/database";
import { models } from "../prisma/catalog-data";

it("blocks the development URL in Vercel Production and requires Preview metadata on Vercel", () => {
  const env = { DATABASE_URL: "postgresql://local:local@127.0.0.1:5432/ryhme" };
  expect(databaseEnv.safeParse({ ...env, VERCEL: "1", VERCEL_ENV: "preview" }).success).toBe(true);
  expect(databaseEnv.safeParse({ ...env, VERCEL_ENV: "production" }).success).toBe(false);
  expect(databaseEnv.safeParse({ ...env, VERCEL_TARGET_ENV: "production" }).success).toBe(false);
  expect(databaseEnv.safeParse({ ...env, VERCEL: "1" }).success).toBe(false);
});

describe("database configuration", () => {
  it("allows explicitly enabled Vercel Production while rejecting conflicting deployment metadata", () => {
    const env = { DATABASE_URL: "postgresql://reader@db.example/ryhme", VERCEL: "1",
      VERCEL_ENV: "production", VERCEL_TARGET_ENV: "production" };
    expect(databaseEnv.safeParse(env).success).toBe(false);
    const enabled = { ...env, RYHME_ALLOW_PRODUCTION_DB: "1" };
    expect(databaseConnectionString(enabled)).toBe(env.DATABASE_URL);
    expect(databaseEnv.safeParse({ ...enabled, VERCEL_TARGET_ENV: undefined }).success).toBe(true);
    expect(databaseEnv.safeParse({ ...enabled, VERCEL_ENV: "preview" }).success).toBe(false);
    expect(databaseEnv.safeParse({ ...enabled, VERCEL_TARGET_ENV: "preview" }).success).toBe(false);
    expect(databaseEnv.safeParse({ ...enabled, VERCEL: undefined }).success).toBe(false);
  });

  it("accepts PostgreSQL and treats an empty direct URL as unset", () => {
    const url = "postgresql://local:local@127.0.0.1:5432/ryhme";
    expect(databaseConnectionString({ DATABASE_URL: url, DIRECT_URL: "" })).toBe(url);
    expect(databaseEnv.safeParse({ DATABASE_URL: url, DIRECT_URL: "https://wrong.example" }).success).toBe(false);
  });

  it("rejects missing and invalid URLs without echoing input", () => {
    expect(() => databaseConnectionString({})).toThrow("Configure DATABASE_URL");
    expect(() => databaseConnectionString({ DATABASE_URL: "https://sensitive.example" })).toThrow(
      /^Configure DATABASE_URL and, if needed, DIRECT_URL with valid PostgreSQL URLs\.$/,
    );
  });
});

it("keeps seed keys unique and leaves the unreported nano score unknown", () => {
  expect(new Set(models.map(({ slug }) => slug)).size).toBe(models.length);
  expect(new Set(models.map(({ externalModelId }) => externalModelId)).size).toBe(models.length);
  expect(models.find(({ slug }) => slug.startsWith("gpt-4-1-nano"))?.sweBenchScore).toBeNull();
});
