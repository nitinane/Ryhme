import { expect, test } from "@playwright/test";
import { scoreLabel } from "../../src/features/benchmarks/chart-data";

test("homepage ranks source-backed scores and links keyboard selections across views", async ({ page, request }) => {
  await page.goto("/");
  const category = page.getByRole("navigation", { name: "Benchmark categories" });
  const benchmarkForm = page.getByRole("form", { name: "Select benchmark" });
  const benchmark = benchmarkForm.getByRole("combobox", { name: "Benchmark" });
  await expect(category.getByRole("link", { name: "Reasoning" })).toHaveAttribute("aria-current", "page");
  const response = await request.get("/api/rankings?benchmark=gpqa-diamond-epoch-2025-01-27");
  expect(response.ok()).toBe(true);
  const { data, meta } = await response.json();
  const rows = data as { rank: number; name: string; score: string; sourceUrl: string }[];
  expect(rows.length).toBe(Math.min(20, meta.total));
  expect(rows.length).toBeGreaterThan(1);
  expect(rows.map(row => Number(row.score))).toEqual(rows.map(row => Number(row.score)).sort((a, b) => b - a));
  const chart = page.getByRole("figure", { name: meta.benchmark.name });
  const bars = chart.getByRole("button", { name: /^Rank / });
  await expect(bars).toHaveCount(rows.length);
  for (const [index, row] of rows.entries()) {
    await expect(bars.nth(index)).toHaveAccessibleName(`Rank ${row.rank}, ${row.name}: ${scoreLabel(row.score, meta.benchmark.unit)}`);
  }
  await bars.nth(1).press("Enter");
  await expect(page.getByRole("link", { name: "Benchmark result source" })).toHaveAttribute("href", rows[1].sourceUrl);
  const ranked = page.getByRole("table").getByRole("button").nth(1);
  await expect(ranked).toHaveAttribute("aria-pressed", "true");
  await expect(ranked).toHaveAccessibleDescription(`Exact score: ${scoreLabel(rows[1].score, meta.benchmark.unit)}`);
  const pricePlot = page.getByRole("figure", { name: "Price vs. score" });
  await expect(pricePlot.getByRole("button", { pressed: true })).toHaveAccessibleName(new RegExp("^" + rows[1].name.split(":")[0]));
  await page.getByRole("table").getByRole("button").first().press("Space");
  await expect(bars.first()).toHaveAttribute("aria-pressed", "true");

  await category.getByRole("link", { name: "Coding" }).press("Enter");
  await expect(category.getByRole("link", { name: "Coding" })).toHaveAttribute("aria-current", "page");
  const alternatives = await benchmark.locator('option[value]:not([value=""])').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  const current = await benchmark.inputValue();
  const next = alternatives.find(value => value !== current) ?? current;
  await benchmark.selectOption(next);
  await benchmarkForm.getByRole("button", { name: "Apply" }).press("Enter");
  await expect(page).toHaveURL(new RegExp(`[?&]benchmark=${next}`));
  await expect(benchmark).toHaveValue(next);
});

test("homepage stays within desktop, tablet, and mobile layouts and links to catalog search", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(page.getByRole("heading", { name: "Ranking data" })).toBeVisible();
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
  const brandBox = await nav.getByRole("link", { name: "Rhyme" }).boundingBox();
  const searchBox = await nav.getByRole("button", { name: /Search/ }).boundingBox();
  expect(brandBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(Math.abs(brandBox!.y + brandBox!.height / 2 - searchBox!.y - searchBox!.height / 2)).toBeLessThan(4);

  await nav.getByRole("button", { name: "Toggle color theme" }).press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("searchbox", { name: "Search model catalog" }).fill("Gemma");
  await page.getByRole("button", { name: "Find models" }).click();
  await expect(page).toHaveURL(/\/models\?q=Gemma/);
  await expect(page.getByRole("link", { name: "Gemma 3 27B Instruct" })).toBeVisible();
});
