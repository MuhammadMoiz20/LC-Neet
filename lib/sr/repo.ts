import type Database from "better-sqlite3";

export type ReviewRow = {
  id: number;
  user_id: number;
  problem_id: number;
  due_at: number;
  ease: number;
  interval_days: number;
};

export function upsertReview(
  db: Database.Database,
  r: { user_id: number; problem_id: number; due_at: number; ease: number; interval_days: number },
): void {
  db.prepare(
    `INSERT INTO review_queue (user_id, problem_id, due_at, ease, interval_days)
     VALUES (@user_id, @problem_id, @due_at, @ease, @interval_days)
     ON CONFLICT(user_id, problem_id) DO UPDATE SET
       due_at = excluded.due_at,
       ease = excluded.ease,
       interval_days = excluded.interval_days`,
  ).run(r);
}

export function dueReviews(
  db: Database.Database,
  userId: number,
  now: number,
  limit = 20,
): ReviewRow[] {
  return db.prepare(
    `SELECT id, user_id, problem_id, due_at, ease, interval_days
     FROM review_queue WHERE user_id = ? AND due_at <= ?
     ORDER BY due_at ASC LIMIT ?`,
  ).all(userId, now, limit) as ReviewRow[];
}

export function getReviewState(
  db: Database.Database,
  userId: number,
  problemId: number,
): Pick<ReviewRow, "ease" | "interval_days" | "due_at"> | null {
  const r = db.prepare(
    `SELECT ease, interval_days, due_at FROM review_queue
     WHERE user_id = ? AND problem_id = ?`,
  ).get(userId, problemId) as Pick<ReviewRow, "ease" | "interval_days" | "due_at"> | undefined;
  return r ?? null;
}
