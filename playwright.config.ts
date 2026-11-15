import { defineConfig } from "@playwright/test";
import path from "node:path";

// E2E runs against its own local database and its own port. `.env.local`
// points at production Turso, and a dev server already running on :3000 would
// too, so neither is ever reused: these tests write attempts and chat rows.
const DB = "data/e2e.db";
const PORT = 3210;
const BASE_URL = `http://localhost:${PORT}`;
process.env.TURSO_DATABASE_URL = DB; // global-setup creates the user in the same file

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: path.resolve("tests/e2e/global-setup.ts"),
  workers: 1, // one SQLite file, one dev server
  use: {
    baseURL: BASE_URL,
    storageState: "tests/e2e/.auth/state.json",
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TURSO_DATABASE_URL: DB,
      TURSO_AUTH_TOKEN: "",
      AUTH_URL: BASE_URL,
      AUTH_TRUST_HOST: "true",
    },
  },
});
