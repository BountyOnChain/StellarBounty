import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("accessibility (axe-core)", () => {
  test("home page has zero critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
    expect(results.violations.filter((v) => v.impact === "serious")).toEqual([]);
  });

  test("bounty list page has zero critical accessibility violations", async ({ page }) => {
    await page.goto("/bounties");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
    expect(results.violations.filter((v) => v.impact === "serious")).toEqual([]);
  });
});