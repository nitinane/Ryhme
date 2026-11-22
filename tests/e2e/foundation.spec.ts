import { expect, test } from "@playwright/test";

test("the public page reads the catalog count and fits a mobile viewport", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page).toHaveTitle("Rhyme | AI model discovery");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Rhyme" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveText("Rhyme");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Rhyme");
  await expect(page.getByRole("heading", { name: "Model performance, in context." })).toBeVisible();
  const models = await request.get("/api/models?limit=1");
  expect(models.ok()).toBe(true);
  const { meta } = await models.json();
  await expect(page.getByRole("region", { name: "Catalog at a glance" })
    .getByRole("link", { name: `${meta.total.toLocaleString("en-US")} models`, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ranking data" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ data: { status: "ok" } });
  expect(health.headers()["cache-control"]).toBe("no-store");
});
