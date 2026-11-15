import type Database from "libsql";
import type { Stage } from "./stage";

/**
 * What the user did by hand to a problem, as opposed to what their submissions
 * say: `started` (they opened it, which is what moves Not started to
 * Attempting) and `pinned` (the board column they dragged it to, when that
 * differs from what its history implies).
 */
export type Mark = { started: boolean; pinned: Stage | null };

export function listMarks(db: Database.Database, userId: number): Map<number, Mark> {
  const rows = db
    .prepare(`SELECT problem_id, started, pinned_stage FROM problem_marks WHERE user_id = ?`)
    .all(userId) as { problem_id: number; started: number; pinned_stage: Stage | null }[];
  return new Map(rows.map((r) => [r.problem_id, { started: r.started === 1, pinned: r.pinned_stage }]));
}

/**
 * Opening a problem. Also lifts a "Not started" pin, since opening it is
 * starting it. Returns true when anything changed.
 */
export function markStarted(db: Database.Database, userId: number, problemId: number): boolean {
  const info = db
    .prepare(
      `INSERT INTO problem_marks (user_id, problem_id, started) VALUES (?, ?, 1)
       ON CONFLICT(user_id, problem_id) DO UPDATE SET
         started = 1,
         pinned_stage = CASE WHEN pinned_stage = 'todo' THEN NULL ELSE pinned_stage END
       WHERE started = 0 OR pinned_stage = 'todo'`,
    )
    .run(userId, problemId);
  return info.changes > 0;
}

export function clearStarted(db: Database.Database, userId: number, problemId: number): void {
  db.prepare(`UPDATE problem_marks SET started = 0 WHERE user_id = ? AND problem_id = ?`).run(
    userId,
    problemId,
  );
}

/** Pin a problem to a board column, or lift the pin with null. */
export function setPin(
  db: Database.Database,
  userId: number,
  problemId: number,
  stage: Stage | null,
): void {
  db.prepare(
    `INSERT INTO problem_marks (user_id, problem_id, pinned_stage) VALUES (?, ?, ?)
     ON CONFLICT(user_id, problem_id) DO UPDATE SET pinned_stage = excluded.pinned_stage`,
  ).run(userId, problemId, stage);
}
