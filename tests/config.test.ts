import { describe, expect, it } from "vitest";
import { databaseConnectionString, databaseEnv } from "../src/lib/config/database";
import { models } from "../prisma/catalog-data";

describe("database configuration", () => {
  it("accepts PostgreSQL and treats an empty direct URL as unset", () => {
    const url = "postgresql://local:local@127.0.0.1:5432/oneatlas";
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
