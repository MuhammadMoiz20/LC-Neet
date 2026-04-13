import { test, expect } from "@playwright/test";

test("redirects unauthenticated user to /login", async ({ page }) => {
  await page.goto("/");
  expect(page.url()).toContain("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
