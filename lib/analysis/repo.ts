import type Database from "better-sqlite3";

export type AnalysisKind =
  | "grade"
  | "quality"
  | "complexity"
  | "comparison"
  | "pattern"
  | "mistake"
  | "interview_debrief";
export type AnalysisStatus = "pending" | "done" | "error";

export type Analysis = {
  id: number;
  attempt_id: number;
  kind: AnalysisKind;
  content_md: string;
  status: AnalysisStatus;
  created_at: number;
};

export type Mistake = {
  id: number;
  problem_id: number;
  category: string;
  note: string;
  created_at: number;
};

export type PatternCounter = {
  pattern: string;
  solved_count: number;
};

const KIND_ORDER: AnalysisKind[] = [
  "grade",
  "quality",
  "complexity",
  "comparison",
  "pattern",
  "mistake",
  "interview_debrief",
];

export function upsertAnalysis(
  db: Database.Database,
  row: { attempt_id: number; kind: AnalysisKind; content_md: string; status: AnalysisStatus },
): void {
  db.prepare(
    `INSERT INTO analyses (attempt_id, kind, content_md, status)
     VALUES (@attempt_id, @kind, @content_md, @status)
     ON CONFLICT(attempt_id, kind) DO UPDATE SET
       content_md = excluded.content_md,
       status = excluded.status,
       created_at = strftime('%s','now')`,
  ).run(row);
}

export function getByAttempt(db: Database.Database, attemptId: number): Analysis[] {
  const rows = db.prepare(
    `SELECT id, attempt_id, kind, content_md, status, created_at
     FROM analyses WHERE attempt_id = ?`,
  ).all(attemptId) as Analysis[];
  rows.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return rows;
}

export function recordMistake(
  db: Database.Database,
  m: { user_id: number; problem_id: number; attempt_id: number; category: string; note: string },
): number {
  const info = db.prepare(
    `INSERT INTO mistakes (user_id, problem_id, attempt_id, category, note)
     VALUES (@user_id, @problem_id, @attempt_id, @category, @note)`,
  ).run(m);
  return Number(info.lastInsertRowid);
}

export function listMistakesForUser(
  db: Database.Database,
  userId: number,
  limit = 50,
): Mistake[] {
  return db.prepare(
    `SELECT id, problem_id, category, note, created_at
     FROM mistakes WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`,
  ).all(userId, limit) as Mistake[];
}

export function bumpPattern(db: Database.Database, userId: number, pattern: string): void {
  db.prepare(
    `INSERT INTO pattern_counters (user_id, pattern, solved_count)
     VALUES (?, ?, 1)
     ON CONFLICT(user_id, pattern) DO UPDATE SET solved_count = solved_count + 1`,
  ).run(userId, pattern);
}

export function listPatternCounters(
  db: Database.Database,
  userId: number,
): PatternCounter[] {
  return db.prepare(
    `SELECT pattern, solved_count FROM pattern_counters WHERE user_id = ? ORDER BY solved_count DESC`,
  ).all(userId) as PatternCounter[];
}
