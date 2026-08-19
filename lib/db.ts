import Database from "libsql";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE TABLE IF NOT EXISTS problems (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK(difficulty IN ('Easy','Medium','Hard')),
  topic TEXT NOT NULL,
  neetcode_video_url TEXT,
  description_md TEXT NOT NULL,
  starter_code TEXT NOT NULL,
  test_cases_json TEXT NOT NULL,
  editorial_md TEXT,
  method_name TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  code TEXT NOT NULL,
  status TEXT NOT NULL,
  runtime_ms INTEGER,
  mode TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS attempts_user_problem ON attempts(user_id, problem_id);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('socratic','hints','style','interview')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS chat_user_problem ON chat_messages(user_id, problem_id, created_at);
CREATE TABLE IF NOT EXISTS analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  kind TEXT NOT NULL CHECK(kind IN ('grade','quality','complexity','comparison','pattern','mistake','interview_debrief')),
  content_md TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','done','error')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(attempt_id, kind)
);
CREATE INDEX IF NOT EXISTS analyses_attempt ON analyses(attempt_id);
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  attempt_id INTEGER NOT NULL REFERENCES attempts(id),
  category TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS mistakes_user_problem ON mistakes(user_id, problem_id);
CREATE TABLE IF NOT EXISTS pattern_counters (
  user_id INTEGER NOT NULL REFERENCES users(id),
  pattern TEXT NOT NULL,
  solved_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, pattern)
);
CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  due_at INTEGER NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, problem_id)
);
CREATE INDEX IF NOT EXISTS review_due ON review_queue(user_id, due_at);
CREATE TABLE IF NOT EXISTS daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  problem_id INTEGER NOT NULL REFERENCES problems(id),
  completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);
`;

let cached: Database.Database | null = null;
let cachedPath: string | null = null;

/**
 * Remote Turso is used when TURSO_DATABASE_URL is set (serverless deploys,
 * where the filesystem is read-only and ephemeral). Otherwise we open a local
 * SQLite file, which is what dev, tests, and the Mac Studio box do.
 */
function isRemote(target: string): boolean {
  return target.startsWith("libsql://") || target.startsWith("https://");
}

function defaultTarget(): string {
  return process.env.TURSO_DATABASE_URL || "data/app.db";
}

function open(target: string): Database.Database {
  if (isRemote(target)) {
    // `authToken` is accepted at runtime but missing from libsql's (stale) types.
    return new Database(target, {
      authToken: process.env.TURSO_AUTH_TOKEN,
    } as Database.Options);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return new Database(target);
}

/**
 * libsql's `.get()` decorates rows with a `_metadata` key that better-sqlite3
 * never returned. Strip it once here so no call site has to care.
 */
function stripMetadata<T>(row: T): T {
  if (row && typeof row === "object" && "_metadata" in row) {
    delete (row as Record<string, unknown>)._metadata;
  }
  return row;
}

function wrapPrepare(db: Database.Database): void {
  const original = db.prepare.bind(db);
  db.prepare = ((sql: string) => {
    const stmt = original(sql);
    const get = stmt.get.bind(stmt);
    stmt.get = ((...args: unknown[]) => stripMetadata(get(...args))) as typeof stmt.get;
    return stmt;
  }) as typeof db.prepare;
}

export function getDb(filePath = defaultTarget()): Database.Database {
  if (cached && cachedPath === filePath && cached.open) return cached;
  const db = open(filePath);
  wrapPrepare(db);
  if (!isRemote(filePath)) {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  db.exec(SCHEMA);
  const cols = db.prepare("PRAGMA table_info(problems)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "method_name")) {
    db.exec("ALTER TABLE problems ADD COLUMN method_name TEXT NOT NULL DEFAULT ''");
  }
  const chatModeCheck = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_messages'`)
    .get() as { sql: string } | undefined;
  if (chatModeCheck && !chatModeCheck.sql.includes("'style'")) {
    db.exec(`
      BEGIN;
      ALTER TABLE chat_messages RENAME TO chat_messages_old;
      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        problem_id INTEGER NOT NULL REFERENCES problems(id),
        role TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('socratic','hints','style')),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
      INSERT INTO chat_messages (id, user_id, problem_id, role, content, mode, created_at)
        SELECT id, user_id, problem_id, role, content, mode, created_at FROM chat_messages_old;
      DROP TABLE chat_messages_old;
      CREATE INDEX IF NOT EXISTS chat_user_problem ON chat_messages(user_id, problem_id, created_at);
      COMMIT;
    `);
  }
  const chatModeCheck2 = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='chat_messages'`,
  ).get() as { sql: string } | undefined;
  if (chatModeCheck2 && !chatModeCheck2.sql.includes("'interview'")) {
    db.exec(`
      BEGIN;
      ALTER TABLE chat_messages RENAME TO chat_messages_old;
      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        problem_id INTEGER NOT NULL REFERENCES problems(id),
        role TEXT NOT NULL CHECK(role IN ('user','assistant')),
        content TEXT NOT NULL,
        mode TEXT NOT NULL CHECK(mode IN ('socratic','hints','style','interview')),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
      );
      INSERT INTO chat_messages (id, user_id, problem_id, role, content, mode, created_at)
        SELECT id, user_id, problem_id, role, content, mode, created_at FROM chat_messages_old;
      DROP TABLE chat_messages_old;
      CREATE INDEX IF NOT EXISTS chat_user_problem ON chat_messages(user_id, problem_id, created_at);
      COMMIT;
    `);
  }
  const analysesKindCheck = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='analyses'`,
  ).get() as { sql: string } | undefined;
  if (
    analysesKindCheck &&
    (!analysesKindCheck.sql.includes("'interview_debrief'") ||
      !analysesKindCheck.sql.includes("'grade'"))
  ) {
    db.exec(`
      BEGIN;
      ALTER TABLE analyses RENAME TO analyses_old;
      CREATE TABLE analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL REFERENCES attempts(id),
        kind TEXT NOT NULL CHECK(kind IN ('grade','quality','complexity','comparison','pattern','mistake','interview_debrief')),
        content_md TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','done','error')),
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        UNIQUE(attempt_id, kind)
      );
      INSERT INTO analyses (id, attempt_id, kind, content_md, status, created_at)
        SELECT id, attempt_id, kind, content_md, status, created_at FROM analyses_old;
      DROP TABLE analyses_old;
      CREATE INDEX IF NOT EXISTS analyses_attempt ON analyses(attempt_id);
      COMMIT;
    `);
  }
  cached = db;
  cachedPath = filePath;
  return db;
}

export function __resetDbCache(): void {
  if (cached && cached.open) {
    try {
      cached.close();
    } catch {
      // ignore
    }
  }
  cached = null;
  cachedPath = null;
}
