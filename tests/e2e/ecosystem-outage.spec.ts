import { spawn } from "node:child_process";
import { expect, test } from "@playwright/test";

test("ecosystem pages and APIs handle an unreachable PostgreSQL connection", async ({ page, request }) => {
  const port = "3101";
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
    env: { ...process.env, DATABASE_URL: "postgresql://unavailable@127.0.0.1:1/oneatlas" },
    stdio: "ignore",
    windowsHide: true,
  });

  try {
    await expect.poll(async () => {
      try {
        return (await request.get(`${base}/api/health`, { timeout: 1_000 })).status();
      } catch {
        return 0;
      }
    }, { timeout: 12_000 }).toBe(503);

    for (const path of ["/rankings", "/labs/google-deepmind", "/providers/openrouter"]) {
      const response = await request.get(`${base}/api${path}`);
      expect(response.status()).toBe(503);
      expect(await response.json()).toEqual({
        data: null, error: { code: "SERVICE_UNAVAILABLE", message: "Catalog temporarily unavailable." },
      });
      await page.goto(base + path);
      await expect(page.getByRole("heading", { name: "Catalog evidence unavailable" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    }
  } finally {
    server.kill();
  }
});
