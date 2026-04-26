import { test, expect } from "@playwright/test";

const HAS_AUTH = !!process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_AGENT_AUTH_OK === "1";

test.skip(!HAS_AUTH, "no agent auth available — set CLAUDE_AGENT_AUTH_OK=1 if Claude Max is logged in");

test("coach drawer streams a hint and persists history", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/problem/two-sum");
  // Set up the wait before clicking so we don't miss the initial GET.
  // This GET races with the user's send: if it resolves AFTER the optimistic
  // push, it overwrites the assistant placeholder and streamed deltas get dropped.
  const initialLoad = page.waitForResponse(
    (res) => res.url().includes("/api/coach?problemId=") && res.request().method() === "GET",
  );
  await page.getByRole("button", { name: /Coach/ }).click();
  const aside = page.locator("aside");
  await expect(aside).toBeVisible();
  await initialLoad;

  const input = aside.getByPlaceholder("Ask the coach…");
  await input.fill("what data structure should I think about?");
  await aside.getByRole("button", { name: "Send" }).click();

  // Wait for the assistant bubble to contain more than just the placeholder ellipsis.
  // Each message renders as a div containing a "ROLE" label div plus the content text.
  // We find the last bubble whose label is "assistant" and assert it has substantive text.
  const lastAssistantBubble = aside
    .locator("div", { has: page.locator("div", { hasText: /^assistant$/i }) })
    .last();
  await expect(lastAssistantBubble).toContainText(/\w{4,}/, { timeout: 30_000 });
  // Ensure the content goes beyond just the "ASSISTANT" label + ellipsis placeholder.
  await expect
    .poll(
      async () => {
        const text = (await lastAssistantBubble.textContent()) ?? "";
        // Strip the "assistant" label and any whitespace/ellipsis to see if real content arrived.
        return text.replace(/assistant/i, "").replace(/[…\s]/g, "").length;
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(10);

  await page.reload();
  await page.getByRole("button", { name: /Coach/ }).click();
  await expect(
    aside.getByText("what data structure should I think about?").first(),
  ).toBeVisible();
});
