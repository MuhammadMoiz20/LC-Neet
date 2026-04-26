import { test, expect } from "@playwright/test";

const HAS_AUTH =
  !!process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_AGENT_AUTH_OK === "1";
const RUN = process.env.RUN_ANALYSIS_E2E === "1";

test.skip(!RUN || !HAS_AUTH, "set RUN_ANALYSIS_E2E=1 + agent auth to run");

test("submitting a correct solution renders all 5 analysis sections", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/problem/two-sum");

  // Replace starter with a known-correct two-sum solution.
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(
    [
      "class Solution:",
      "    def twoSum(self, nums, target):",
      "        seen = {}",
      "        for i, n in enumerate(nums):",
      "            if target - n in seen:",
      "                return [seen[target - n], i]",
      "            seen[n] = i",
      "        return []",
    ].join("\n"),
  );

  await page.getByRole("button", { name: /Run tests/ }).click();

  const link = page.getByRole("link", { name: /Analysis ready/ });
  await expect(link).toBeVisible({ timeout: 60_000 });
  await link.click();

  for (const heading of [
    "Code Quality",
    "Complexity",
    "Comparison to Optimal",
    "Pattern",
    "Mistake Detection",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  // Wait until no section is still "pending" (poll status pills).
  await expect
    .poll(
      async () => (await page.getByText("pending").count()),
      { timeout: 120_000 },
    )
    .toBe(0);
});
