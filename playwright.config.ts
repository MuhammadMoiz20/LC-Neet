import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: path.resolve("tests/e2e/global-setup.ts"),
  use: {
    baseURL: "http://localhost:3000",
    storageState: "tests/e2e/.auth/state.json",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
