import { expect, it } from "vitest";
import { neonDevelopmentUrls } from "../src/lib/config/neon";

const host = "ep-preview.example-region.aws.neon.tech";
const expected = { host, database: "oneatlas_dev", role: "oneatlas_dev" };
const direct = `postgresql://oneatlas_dev:example@SELF/oneatlas_dev?sslmode=require&channel_binding=require`;
const env = {
  DATABASE_URL: direct.replace("SELF", host.replace(".", "-pooler.")),
  DIRECT_URL: direct.replace("SELF", host),
};

it("requires both connections to match the independently supplied Neon identity and verifies TLS", () => {
  const results = neonDevelopmentUrls(env, expected);
  expect(results.map(({ key }) => key)).toEqual(["DATABASE_URL", "DIRECT_URL"]);
  expect(results.every(({ url }) => new URL(url).searchParams.get("sslmode") === "verify-full")).toBe(true);
});

it("rejects another endpoint, role, database, pool mode, or insecure query settings", () => {
  for (const url of [
    env.DIRECT_URL.replace("ep-preview", "ep-production"),
    env.DIRECT_URL.replace("oneatlas_dev:", "wrong_role:"),
    env.DIRECT_URL.replace("/oneatlas_dev", "/postgres"),
    env.DIRECT_URL.replace("sslmode=require", "sslmode=disable"),
    env.DIRECT_URL + "&sslmode=disable",
    env.DATABASE_URL,
  ]) {
    expect(() => neonDevelopmentUrls({ ...env, DIRECT_URL: url }, expected)).toThrow(/^DIRECT_URL does not match/);
  }
});
