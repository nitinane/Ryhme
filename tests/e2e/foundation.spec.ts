import { expect, test } from "@playwright/test";

test("the public page reads the seeded count and fits a mobile viewport", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page).toHaveTitle("Ryhme | AI model discovery");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Ryhme" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toHaveText("Ryhme");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Ryhme");
  await expect(page.getByRole("heading", { name: "Intelligence Studio" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Catalog at a glance" }).getByRole("link", { name: "4 models", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest discoveries" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ data: { status: "ok" } });
  expect(health.headers()["cache-control"]).toBe("no-store");
});
