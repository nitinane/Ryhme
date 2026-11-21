import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { catalogUrl } from "../src/ingestion/openrouter-catalog";
import { developmentTarget, runCatalogSchedule, scheduledCatalogUrl } from "../src/ingestion/openrouter-schedule";

const workflow = {
  GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "nitinane/Ryhme", GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "schedule", RYHME_CATALOG_SYNC_ENABLED: "true",
};
const { host, role, database } = developmentTarget;

describe("scheduled catalog target", () => {
  it("requires an enabled trusted workflow and its dedicated direct development credential", () => {
    const keyFixture = `postgresql://${role}:fixture@${host}/${database}?sslmode=require`;
    expect(new URL(scheduledCatalogUrl({ ...workflow, DIRECT_URL: keyFixture })).searchParams.get("sslmode")).toBe("verify-full");
    expect(() => scheduledCatalogUrl(workflow)).toThrow("DIRECT_URL does not match");
    for (const changed of [
      keyFixture.replace(host, "ep-other.eu-west-1.aws.neon.tech"),
      keyFixture.replace(host, host.replace(".", "-pooler.")),
      keyFixture.replace(role, "neondb_owner"),
      keyFixture.replace("/neondb", "/postgres"),
      keyFixture.replace("require", "disable"),
    ]) expect(() => scheduledCatalogUrl({ ...workflow, DIRECT_URL: changed })).toThrow("DIRECT_URL does not match");
    for (const change of [
      { GITHUB_REPOSITORY: "fork/Ryhme" }, { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_REF: "refs/heads/other" }, { RYHME_CATALOG_SYNC_ENABLED: "false" },
    ]) expect(() => scheduledCatalogUrl({ ...workflow, ...change, DIRECT_URL: keyFixture })).toThrow("disabled");
  });
});

const testUrl = process.env.RYHME_SYNC_TEST_DATABASE_URL;
const target = { database: "ryhme_test", role: "ryhme_catalog_sync" };

describe.skipIf(!testUrl)("scheduled catalog with disposable PostgreSQL", () => {
  let db: PrismaClient;
  beforeAll(() => {
    const url = new URL(testUrl!);
    if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.pathname !== "/ryhme_test"
      || url.username !== target.role || url.search || url.hash) {
      throw new Error("Integration tests require the dedicated role and loopback disposable ryhme_test database.");
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href, max: 4 }) });
  });
  afterAll(() => db?.$disconnect());

  const alpha = {
    id: "test-publisher/alpha", name: "Test Alpha", context_length: 128_000,
    pricing: { prompt: "0.000002", completion: "0.000004" },
    architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
  };
  const beta = { ...alpha, id: "test-publisher/beta", name: "Test Beta" };
  const at = (hours: number) => new Date(Date.UTC(2028, 0, 1, hours));
  const sync = (rows: unknown[], hours: number) => runCatalogSchedule(db, target, async () => rows, () => at(hours));
  const offer = () => db.offering.findFirstOrThrow({ where: { sourceUrl: catalogUrl, externalModelId: alpha.id },
    include: { prices: { orderBy: { observedAt: "asc" } }, model: true } });
  const lastSync = async () => (await db.dataSource.findUniqueOrThrow({ where: { id: "openrouter" } })).catalogSyncedAt;

  it("discovers models and appends only changed prices, retains known metadata, and restores missing listings", async () => {
    expect(await sync([alpha], 0)).toMatchObject({ models: 1, offerings: 1, prices: 1 });
    const first = await offer();
    expect(await sync([alpha], 6)).toMatchObject({ models: 0, offerings: 0, prices: 0, metadataUpdates: 0 });
    expect((await offer()).observedAt).toEqual(at(6));
    expect((await offer()).model.updatedAt).toEqual(first.model.updatedAt);
    const changed = { ...alpha, name: "Test Alpha Updated", context_length: null,
      pricing: { prompt: "0.000003" } };
    expect(await sync([changed, beta], 12)).toMatchObject({ models: 1, prices: 2, metadataUpdates: 1 });
    const updated = await offer();
    expect(updated.model).toMatchObject({ canonicalName: changed.name, contextTokens: 128_000,
      modalities: { input: ["text", "image"], output: ["text"] } });
    expect(updated.prices.map(row => [String(row.inputPerMillion), String(row.outputPerMillion), row.observedAt]))
      .toEqual([["2", "4", at(0)], ["3", "4", at(12)]]);
    expect(await sync([beta, changed, { ...changed, name: "conflicting duplicate" }], 18))
      .toMatchObject({ duplicateIds: 1, removalDeferred: true, newlyMissing: 0 });
    expect(await sync([beta], 24)).toMatchObject({ newlyMissing: 1, unavailable: 0 });
    expect((await offer()).availabilityStatus).toBe("LISTED");
    expect(await sync([beta], 47)).toMatchObject({ newlyMissing: 0, unavailable: 0 });
    expect(await sync([beta], 48)).toMatchObject({ unavailable: 1 });
    expect((await offer()).availabilityStatus).toBe("UNAVAILABLE");
    expect((await offer()).observedAt).toEqual(at(12));
    expect(await sync([changed, beta], 54)).toMatchObject({ restored: 1, prices: 0 });
    expect(await offer()).toMatchObject({ availabilityStatus: "LISTED", catalogMissingSince: null, observedAt: at(54) });
    expect(await lastSync()).toEqual(at(54));
  });

  it("rejects wrong targets, handles upstream failure without writes, and prevents overlapping transactions", async () => {
    const upstream = vi.fn(async () => { throw new Error("upstream unavailable"); });
    await expect(runCatalogSchedule(db, { ...target, role: "wrong" }, upstream)).rejects.toThrow("identity mismatch");
    expect(upstream).not.toHaveBeenCalled();
    const before = await lastSync();
    await expect(runCatalogSchedule(db, target, upstream)).rejects.toThrow("upstream unavailable");
    expect(await lastSync()).toEqual(before);

    let release!: () => void;
    let ready!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    const acquired = new Promise<void>(resolve => { ready = resolve; });
    const owner = runCatalogSchedule(db, target, async () => {
      ready();
      await paused;
      return [beta, alpha];
    }, () => at(60));
    try {
      await Promise.race([acquired, owner]);
      await expect(runCatalogSchedule(db, target, upstream)).rejects.toThrow("already running");
      expect(upstream).toHaveBeenCalledTimes(1);
    } finally { release(); await owner; }
    expect(await lastSync()).toEqual(at(60));
  });

  it("rolls back catalog writes when PostgreSQL rejects a batch and recovers on the next run", async () => {
    const before = await lastSync();
    const bad = { ...alpha, id: "rollback-namespace/model", name: "Invalid\u0000name" };
    await expect(sync([alpha, beta, bad], 66)).rejects.toThrow();
    expect(await lastSync()).toEqual(before);
    expect(await db.lab.count({ where: { name: "rollback-namespace (OpenRouter namespace)" } })).toBe(0);
    expect(await sync([alpha, beta, { ...bad, name: "Recovered model" }], 66)).toMatchObject({ models: 1 });
    expect(await lastSync()).toEqual(at(66));
  });

});
