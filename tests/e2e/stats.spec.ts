import { test, expect } from "@playwright/test";

const RUN = process.env.RUN_ENGAGEMENT_E2E === "1";

test.skip(!RUN, "set RUN_ENGAGEMENT_E2E=1 to run");

test("stats page renders all sections", async ({ page }) => {
  await page.goto("/stats");
  for (const heading of [
    "Solved by topic",
    "Solved by difficulty",
    "Recent mistakes",
    "Pattern mastery",
    "Due reviews",
  ]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
});
