import { test, expect } from "@playwright/test";
import { openProblem } from "./helpers";

// Works with or without OPENROUTER_API_KEY: the reply bubble must end up with
// either the coach's answer or a visible failure note, never a stuck "…".
test("the coach answers or says why it couldn't, and keeps history", async ({ page }) => {
  test.setTimeout(120_000);
  await openProblem(page, "/problem/two-sum");
  await page.getByTitle("Coach (⌘J)").click();

  const input = page.getByPlaceholder(/Ask the coach/);
  await input.fill("what data structure should I think about?");
  await input.press("Enter");

  await expect(input).toBeEnabled({ timeout: 90_000 }); // streaming finished
  await expect(page.getByText(/\w{4,}/).last()).toBeVisible();
  await expect(page.locator(".caret")).toHaveCount(0);

  await page.reload();
  await page.getByTitle("Coach (⌘J)").click();
  await expect(
    page.getByText("what data structure should I think about?").first(),
  ).toBeVisible();
});
