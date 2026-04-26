import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { getDb, __resetDbCache } from "../../lib/db";
import { createUser, verifyPassword } from "../../lib/auth/users";

export default async function globalSetup(config: FullConfig) {
  __resetDbCache();
  const db = getDb();
  const exists = await verifyPassword(db, "e2e@example.com", "e2e-password-1");
  if (!exists) {
    try {
      await createUser(db, "e2e@example.com", "e2e-password-1");
    } catch {
      // already exists with a different password — fine
    }
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";
  await page.goto(`${baseURL}/login`);
  await page.getByPlaceholder("Email").fill("e2e@example.com");
  await page.getByPlaceholder("Password").fill("e2e-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseURL}/`);
  const storagePath = path.join("tests/e2e/.auth/state.json");
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  await ctx.storageState({ path: storagePath });
  await browser.close();
}
