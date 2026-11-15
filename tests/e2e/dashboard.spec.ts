import { test, expect } from "@playwright/test";
import { openProblem, setCode, TWO_SUM_SOLUTION } from "./helpers";

test("dashboard shows the attempt after two-sum is accepted", async ({ page }) => {
  await openProblem(page, "/problem/two-sum");
  await setCode(page, TWO_SUM_SOLUTION);
  await page.getByRole("button", { name: /^Submit/ }).click();
  await expect(page.getByRole("button", { name: /Analysis ready/ })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Two Sum/ }).first()).toBeVisible();
  await expect(page.getByText(/[1-9]\d* \/ 150 solved/).first()).toBeVisible();
});
