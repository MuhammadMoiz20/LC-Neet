import { expect, type Page } from "@playwright/test";

export const TWO_SUM_SOLUTION = `class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
`;

/** Open a problem and wait until Python has loaded (the Run button enables). */
export async function openProblem(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("button", { name: /^Run/ })).toBeEnabled({
    timeout: 90_000,
  });
}

/** Replace the editor's contents through Monaco's global API. */
export async function setCode(page: Page, code: string) {
  await page.waitForFunction(
    () =>
      ((window as unknown as { monaco?: { editor: { getModels: () => unknown[] } } })
        .monaco?.editor.getModels().length ?? 0) > 0,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate((c) => {
    (
      window as unknown as {
        monaco: { editor: { getModels: () => { setValue: (v: string) => void }[] } };
      }
    ).monaco.editor.getModels()[0].setValue(c);
  }, code);
}
