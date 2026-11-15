import { test, expect } from "@playwright/test";
import { openProblem, setCode, TWO_SUM_SOLUTION } from "./helpers";

test("a solved problem marked 'Revisit soon' lands in the board's Revisit column", async ({
  page,
}) => {
  await page.goto("/board");
  for (const name of ["Not started", "Attempting", "Revisit", "Solved", "Mastered"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  await openProblem(page, "/problem/two-sum");
  await setCode(page, TWO_SUM_SOLUTION);
  await page.getByRole("button", { name: /^Submit/ }).click();
  await expect(page.getByRole("button", { name: /Analysis ready/ })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Revisit soon" }).click();
  await expect(
    page.getByText("Marked. It'll be back in your queue tomorrow."),
  ).toBeVisible();

  await page.goto("/board");
  const revisit = page.locator("section", {
    has: page.getByRole("heading", { name: "Revisit", exact: true }),
  });
  await expect(revisit.getByRole("link", { name: /Two Sum/ })).toBeVisible();
});
