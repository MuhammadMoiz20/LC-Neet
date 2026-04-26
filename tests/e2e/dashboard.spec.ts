import { test, expect } from "@playwright/test";

test("dashboard shows recent attempt after solving two-sum", async ({ page }) => {
  // Solve Two Sum
  await page.goto("/problem/two-sum");
  const runBtn = page.getByRole("button", { name: /Run tests/ });
  await expect(runBtn).toBeEnabled({ timeout: 60_000 });

  // Replace starter code with a working solution via Monaco's global API.
  const solutionCode = `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
`;
  await page.waitForFunction(
    () =>
      typeof (window as unknown as { monaco?: unknown }).monaco !== "undefined" &&
      (window as unknown as { monaco: { editor: { getEditors: () => unknown[] } } }).monaco.editor.getEditors().length > 0,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate((code) => {
    const w = window as unknown as {
      monaco: { editor: { getEditors: () => Array<{ setValue: (v: string) => void }> } };
    };
    w.monaco.editor.getEditors()[0].setValue(code);
  }, solutionCode);

  await runBtn.click();
  await expect(page.getByText(/Case 1: PASS/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Case 2: PASS/)).toBeVisible();

  // Dashboard should now show the attempt + bumped solved counter
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Recent attempts").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Two Sum/ }).first()).toBeVisible();
  // At least 1 solved
  await expect(page.getByText(/[1-9]\d* \/ 3/).first()).toBeVisible();
});
