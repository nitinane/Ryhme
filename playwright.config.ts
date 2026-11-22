import { defineConfig } from "@playwright/test";
import { playwrightDatabaseEnv } from "./tests/fixtures/playwright-database";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/fixtures/playwright-setup.ts",
  use: { baseURL: "http://127.0.0.1:3100", browserName: "chromium" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/api/health",
    env: playwrightDatabaseEnv(),
    reuseExistingServer: false,
  },
});
