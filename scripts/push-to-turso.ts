/**
 * Copy the local SQLite database (data/app.db) into a remote Turso database.
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npx tsx scripts/push-to-turso.ts
 *
 * Schema is created by getDb(); this only moves rows. Existing rows in the
 * remote are left alone (INSERT OR IGNORE), so re-running is safe.
 */
import Database from "libsql";
import { getDb } from "../lib/db";

const TABLES = [
  "users",
  "problems",
  "attempts",
  "chat_messages",
  "analyses",
  "mistakes",
  "reviews",
  "daily_sessions",
] as const;

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");

const local = new Database(process.env.LOCAL_DB_PATH ?? "data/app.db", {
  readonly: true,
});
const remote = getDb(url); // creates the schema on the remote

for (const table of TABLES) {
  const exists = local
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table);
  if (!exists) {
    console.log(`skip ${table} (not in local db)`);
    continue;
  }
  const rows = local.prepare(`SELECT * FROM ${table}`).all() as Record<
    string,
    unknown
  >[];
  if (rows.length === 0) {
    console.log(`skip ${table} (empty)`);
    continue;
  }
  const cols = Object.keys(rows[0]).filter((c) => c !== "_metadata");
  const stmt = remote.prepare(
    `INSERT OR IGNORE INTO ${table} (${cols.join(",")}) VALUES (${cols
      .map(() => "?")
      .join(",")})`,
  );
  for (const row of rows) stmt.run(...cols.map((c) => row[c]));
  console.log(`copied ${rows.length} rows -> ${table}`);
}

console.log("done");
