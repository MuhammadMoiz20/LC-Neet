import { test, expect } from "@playwright/test";

test("loads two-sum, runs starter code, sees fail results", async ({ page }) => {
  await page.goto("/problem/two-sum");
  await expect(page.getByRole("heading", { name: /Two Sum/ })).toBeVisible();

  const runBtn = page.getByRole("button", { name: /Run tests/ });
  await expect(runBtn).toBeEnabled({ timeout: 60_000 });

  await runBtn.click();

  await expect(page.getByText(/Case 1: (PASS|FAIL)/)).toBeVisible({
    timeout: 30_000,
  });
});
