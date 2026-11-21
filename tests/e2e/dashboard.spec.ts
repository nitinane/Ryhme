import { expect, test } from "@playwright/test";

test("dashboard keeps benchmark evidence and search within desktop, tablet, and mobile layouts", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const search = nav.getByRole("button", { name: /Search/ });
  const chart = page.getByRole("figure", { name: "SWE-bench Verified" });
  await expect(chart.getByRole("button", { name: /54\.6%/ })).toBeVisible();
  await chart.getByRole("button", { name: /54\.6%/ }).press("Enter");
  await expect(chart.getByRole("link", { name: "Benchmark result source" })).toHaveAttribute("href", /openai\.com/);
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  const brandBox = await nav.getByRole("link", { name: "Ryhme" }).boundingBox();
  const searchBox = await search.boundingBox();
  expect(brandBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(Math.abs(brandBox!.y + brandBox!.height / 2 - searchBox!.y - searchBox!.height / 2)).toBeLessThan(4);

  const toggle = nav.getByRole("button", { name: "Toggle color theme" });
  await toggle.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("searchbox", { name: "Search model catalog" }).fill("Gemma");
  await page.getByRole("button", { name: "Find models" }).click();
  await expect(page).toHaveURL(/\/models\?q=Gemma/);
  await expect(page.getByRole("link", { name: "Gemma 3 27B Instruct" })).toBeVisible();
});
