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

/** Parent tables first: Turso enforces foreign keys, unlike the local file. */
const TABLES = [
  "users",
  "problems",
  "attempts",
  "chat_messages",
  "analyses",
  "mistakes",
  "pattern_counters",
  "review_queue",
  "daily",
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
  let copied = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    try {
      stmt.run(...cols.map((c) => row[c]));
      copied++;
    } catch (err) {
      // The local file accumulated rows whose parents were later deleted;
      // SQLite never rejected them because foreign_keys was off for those
      // writes. Skip them rather than aborting the whole migration.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("FOREIGN KEY")) throw err;
      skipped.push(String(row.id ?? JSON.stringify(row)));
    }
  }
  console.log(
    `copied ${copied}/${rows.length} rows -> ${table}` +
      (skipped.length ? `  (skipped orphans: ${skipped.join(", ")})` : ""),
  );
}

console.log("done");
