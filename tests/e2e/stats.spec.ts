import { test, expect } from "@playwright/test";

test("/stats leads to the dashboard, where the stats now live", async ({ page }) => {
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/$/);
});
