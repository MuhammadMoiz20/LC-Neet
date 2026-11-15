import { test, expect } from "@playwright/test";
import { openProblem, setCode } from "./helpers";

// Works with or without OPENROUTER_API_KEY: without one every section settles
// as an error, which is still "settled" — the page must stop waiting either way.
test("a failed submission's analysis starts by itself and settles", async ({ page }) => {
  test.setTimeout(240_000);
  await openProblem(page, "/problem/two-sum");
  await setCode(page, "class Solution:\n    def twoSum(self, nums, target):\n        return []\n");
  await page.getByRole("button", { name: /^Submit/ }).click();
  await expect(page.getByText(/tests passed/)).toBeVisible({ timeout: 30_000 });

  await page.goto("/analysis/latest");
  await expect(page).toHaveURL(/\/analysis\/\d+$/);
  await expect(page.getByRole("button", { name: "Rerun analysis" })).toBeEnabled({
    timeout: 180_000,
  });
});
