import { test, expect } from "@playwright/test";

test("an interview round shows the statement and a timer, without hints", async ({ page }) => {
  await page.goto("/interview");
  await page.getByRole("button", { name: /Start round/ }).click();
  await page.waitForURL(/focus=1&duration=45/);

  await expect(page.locator("text=/^[0-9]{2}:[0-9]{2}$/").first()).toBeVisible();
  await expect(page.locator(".prompt-md")).toBeVisible(); // the problem statement
  await expect(page.locator("iframe")).toHaveCount(0); // no solution video
});

test("when the timer runs out the final attempt is submitted and leads to a debrief", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/problem/two-sum?focus=1&duration=0.2");
  await expect(page.getByText("Session ended")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "View debrief" }).click({ timeout: 120_000 });
  await expect(page).toHaveURL(/\/analysis\/\d+$/);
});
