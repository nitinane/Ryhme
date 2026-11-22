import { expect, test } from "@playwright/test";

test("keyboard navigation switches verified rankings and exposes method and limited coverage", async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("link", { name: "Skip to content" }).press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Leaderboards" }).press("Enter");
  await expect(page.getByRole("heading", { name: "SWE-bench Verified" })).toBeVisible();
  await expect(page.getByText("2 scored · 2 without a comparable score")).toBeVisible();
  const chart = page.getByRole("figure", { name: "Ranked scores" });
  await expect(chart.getByRole("button", { name: /#1 GPT-4\.1 54\.6%/ })).toBeVisible();
  await chart.getByRole("button", { name: /#1 GPT-4\.1 54\.6%/ }).press("Enter");
  await expect(chart.getByRole("link", { name: "Benchmark result source" })).toBeVisible();
  await expect(page.getByText("Evaluation date Unknown", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "OpenAI benchmark source" })).toHaveAttribute("href", /openai\.com\/index\/gpt-4-1/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.getByRole("link", { name: "Mathematics" }).press("Enter");
  await expect(page.getByRole("heading", { name: "AIME 2024" })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table.getByRole("row").nth(1)).toContainText("GPT-4.1 mini");
  await page.locator(".ranking-filter-options > summary").press("Space");
  await page.getByRole("combobox", { name: "Sort", exact: true }).selectOption("worst");
  await page.getByRole("button", { name: "Apply ranking filters" }).click();
  await expect(table.getByRole("row").nth(1)).toContainText("GPT-4.1 nano");
  await expect(chart.getByRole("button").first()).toContainText("GPT-4.1 nano");
  await page.getByRole("link", { name: "Reasoning" }).click();
  await expect(page.getByRole("heading", { name: "GPQA Diamond" })).toBeVisible();
  await page.goto("/rankings?category=reasoning&provider=openrouter");
  await expect(page.getByRole("heading", { name: "No comparable scores on this page" })).toBeVisible();
  await expect(chart.getByRole("button")).toHaveCount(0);
  await page.goto("/rankings?category=unsupported");
  await expect(page.getByRole("heading", { name: "No verified benchmark coverage" })).toBeVisible();

  const ranked = await request.get("/api/rankings?category=coding&limit=1");
  expect(ranked.status()).toBe(200);
  const result = await ranked.json();
  expect(result.meta).toMatchObject({ total: 2, limit: 1, hasMore: true, eligible: 4,
    cohort: { evaluatedModels: 2, distinctFamilies: 1, distinctLabs: 1 } });
  expect(result.data[0]).toMatchObject({ rank: 1, score: "54.60000000" });
  const filtered = await request.get("/api/rankings?category=coding&lab=openai&model=gpt-4-1-mini-2025-04-14");
  expect(filtered.status()).toBe(200);
  expect((await filtered.json()).data).toMatchObject([{ score: "23.60000000" }]);
  const second = await request.get("/api/rankings?category=coding&limit=1&page=2");
  expect((await second.json()).data[0]).toMatchObject({ rank: 2, score: "23.60000000" });
  expect((await request.get("/api/rankings?sort=composite")).status()).toBe(400);
});

test("provider and lab directories cross-link offerings, creators and versions on tablet", async ({ page, request }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/providers");
  await page.getByRole("searchbox", { name: "Search by provider or model name" }).fill("Gemma");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("status")).toHaveText("1 provider");
  await page.getByRole("link", { name: "OpenRouter", exact: true }).click();
  await expect(page.getByRole("heading", { name: "OpenRouter" })).toBeVisible();
  await expect(page.getByText("Pricing unknown.")).toBeVisible();
  await expect(page.getByText("Listed in provider docs", { exact: true }).last()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
  await page.getByRole("link", { name: "Google DeepMind" }).click();
  await expect(page.getByRole("heading", { name: "Google DeepMind" })).toBeVisible();
  await page.getByRole("link", { name: "Gemma 3 27B Instruct" }).click();
  await expect(page.getByRole("heading", { name: "Gemma 3 27B Instruct" })).toBeVisible();
  await expect(page.getByRole("link", { name: "OpenRouter", exact: true })).toHaveAttribute("href", "/providers/openrouter");

  await page.goto("/providers/openai-api");
  await page.getByRole("combobox", { name: "Availability", exact: true }).selectOption("UNAVAILABLE");
  await page.getByRole("combobox", { name: "Model capability" }).selectOption("tool-calling");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/availability=UNAVAILABLE/);
  await expect(page.getByRole("status")).toHaveText("1 offering");
  await expect(page.getByRole("heading", { name: "GPT-4.1 nano" })).toBeVisible();
  await expect(page.getByText("Historical pricing · USD per 1M tokens")).toBeVisible();
  await page.goto("/providers/openrouter?availability=UNAVAILABLE");
  await expect(page.getByText("No offerings match this search or page.")).toBeVisible();

  expect((await request.get("/api/providers?availability=bogus")).status()).toBe(400);
  expect((await request.get("/api/labs/missing")).status()).toBe(404);
  expect((await request.get("/api/labs?q=DeepMind")).status()).toBe(200);
  const provider = await request.get("/api/providers/openrouter");
  const { data } = await provider.json();
  expect(data.offerings).toHaveLength(1);
  expect(data.offerings[0]).toMatchObject({ externalModelId: "google/gemma-3-27b-it", prices: [] });
});

test("publishes all category tabs and lets readers search sourced publisher scores", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/rankings");
  const tabs = page.getByRole("navigation", { name: "Benchmark categories" });
  await expect(tabs.getByRole("link")).toHaveCount(10);
  await expect(page.getByText(/Publisher-reported evaluation/)).toBeVisible();
  const coverage = page.getByLabel("Cohort coverage");
  await expect(coverage.getByRole("definition")).toHaveText(["2", "1", "1"]);
  await page.getByRole("searchbox", { name: "Search rankings" }).fill("mini");
  await page.getByRole("button", { name: "Apply ranking filters" }).click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("table").getByText("23.6%")).toBeVisible();
  await tabs.getByRole("link", {name:"Creative writing"}).click();
  await expect(page.getByRole("heading", {name:"No verified benchmark coverage"})).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});
