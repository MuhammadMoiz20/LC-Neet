import type Database from "better-sqlite3";

export type AttemptStatus = "passed" | "failed" | "error";

export type AttemptInput = {
  user_id: number;
  problem_id: number;
  code: string;
  status: AttemptStatus;
  runtime_ms: number | null;
  mode: string;
};

export type Attempt = AttemptInput & { id: number; created_at: number };

export function recordAttempt(
  db: Database.Database,
  input: AttemptInput,
): number {
  const info = db
    .prepare(
      `INSERT INTO attempts (user_id, problem_id, code, status, runtime_ms, mode)
       VALUES (@user_id, @problem_id, @code, @status, @runtime_ms, @mode)`,
    )
    .run(input);
  return Number(info.lastInsertRowid);
}

export function listAttempts(
  db: Database.Database,
  userId: number,
  problemId: number,
): Attempt[] {
  return db
    .prepare(
      `SELECT id, user_id, problem_id, code, status, runtime_ms, mode, created_at
       FROM attempts
       WHERE user_id = ? AND problem_id = ?
       ORDER BY created_at DESC`,
    )
    .all(userId, problemId) as Attempt[];
}

export type AttemptSummary = {
  id: number;
  status: AttemptStatus;
  created_at: number;
  runtime_ms: number | null;
};

export function listAttemptsByProblem(
  db: Database.Database,
  userId: number,
  problemId: number,
  limit = 10,
): AttemptSummary[] {
  return db
    .prepare(
      `SELECT id, status, created_at, runtime_ms
       FROM attempts
       WHERE user_id = ? AND problem_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(userId, problemId, limit) as AttemptSummary[];
}
