import Database from "better-sqlite3";
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

export function getDb(filePath = "data/app.db"): Database.Database {
  if (cached && cachedPath === filePath && cached.open) return cached;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
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
