import { execFileSync } from "node:child_process";
import { playwrightDatabaseEnv } from "./playwright-database";

export default function verifyFixture() {
  execFileSync(process.execPath, ["--import", "tsx", "tests/seed-check.ts"], {
    env: { ...process.env, ...playwrightDatabaseEnv() },
    stdio: "inherit",
  });
}
