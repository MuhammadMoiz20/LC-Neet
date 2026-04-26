import type Database from "better-sqlite3";

export type DailyRow = {
  id: number;
  user_id: number;
  date: string;
  problem_id: number;
  completed: number;
};

export function getDaily(
  db: Database.Database,
  userId: number,
  date: string,
): DailyRow | null {
  return (
    (db.prepare(
      `SELECT id, user_id, date, problem_id, completed
       FROM daily WHERE user_id = ? AND date = ?`,
    ).get(userId, date) as DailyRow | undefined) ?? null
  );
}

export function getOrCreateDaily(
  db: Database.Database,
  userId: number,
  date: string,
  pickFn: () => number,
): DailyRow {
  const existing = getDaily(db, userId, date);
  if (existing) return existing;
  const problemId = pickFn();
  db.prepare(
    `INSERT INTO daily (user_id, date, problem_id) VALUES (?, ?, ?)`,
  ).run(userId, date, problemId);
  return getDaily(db, userId, date)!;
}

export function markDailyComplete(
  db: Database.Database,
  userId: number,
  date: string,
): void {
  db.prepare(
    `UPDATE daily SET completed = 1 WHERE user_id = ? AND date = ?`,
  ).run(userId, date);
}
