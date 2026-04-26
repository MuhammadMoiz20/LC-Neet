import { test, expect } from "@playwright/test";

const RUN = process.env.RUN_ENGAGEMENT_E2E === "1";

test.skip(!RUN, "set RUN_ENGAGEMENT_E2E=1 to run");

test("interview mode shows timer, hides per-case results, locks coach mode", async ({ page }) => {
  await page.goto("/interview");
  await page.getByRole("button", { name: /Start 30-min session/ }).click();

  await page.waitForURL(/mode=interview&duration=30/);

  // Timer in mm:ss format
  await expect(page.locator("text=/^[0-9]{1,2}:[0-9]{2}$/").first()).toBeVisible();

  // Open coach panel; mode selector should be hidden
  await page.getByRole("button", { name: /Coach/ }).click();
  const aside = page.locator("aside");
  await expect(aside).toBeVisible();
  await expect(aside.locator("select")).toHaveCount(0);

  // Click Run tests; results should not include "PASS"/"FAIL" per-case lines
  await page.getByRole("button", { name: /Run tests/ }).click();
  // Allow Pyodide some time
  await page.waitForTimeout(8000);
  const body = await page.textContent("body");
  expect(body).not.toMatch(/Case 1: PASS|Case 1: FAIL/);
});
