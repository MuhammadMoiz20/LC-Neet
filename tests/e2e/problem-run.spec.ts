import { test, expect } from "@playwright/test";
import { openProblem, setCode } from "./helpers";

test("runs the starter code from inside the editor with ⌘↵", async ({ page }) => {
  await openProblem(page, "/problem/two-sum");
  await expect(page.getByRole("heading", { name: /Two Sum/ })).toBeVisible();

  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press("ControlOrMeta+Enter");

  await expect(page.getByText(/0\/\d+ tests passed/)).toBeVisible({ timeout: 30_000 });
});

test("an endless custom run can be stopped and Python recovers", async ({ page }) => {
  await openProblem(page, "/problem/two-sum");
  await setCode(
    page,
    "class Solution:\n    def twoSum(self, nums, target):\n        while True:\n            pass\n",
  );
  await page.getByRole("button", { name: /Custom input/ }).click();
  await page.getByRole("button", { name: "Run custom" }).click();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: /^Run/ })).toBeEnabled({ timeout: 90_000 });
});
