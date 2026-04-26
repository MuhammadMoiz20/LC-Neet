import type Database from "better-sqlite3";

export type RecentAttempt = {
  id: number;
  problem_id: number;
  problem_slug: string;
  problem_title: string;
  status: string;
  runtime_ms: number | null;
  created_at: number;
};

export function getSolvedProblemIds(
  db: Database.Database,
  userId: number,
): Set<number> {
  const rows = db
    .prepare(
      `SELECT DISTINCT problem_id FROM attempts
       WHERE user_id = ? AND status = 'passed'`,
    )
    .all(userId) as { problem_id: number }[];
  return new Set(rows.map((r) => r.problem_id));
}

export function getRecentAttempts(
  db: Database.Database,
  userId: number,
  limit: number,
): RecentAttempt[] {
  return db
    .prepare(
      `SELECT a.id, a.problem_id, p.slug AS problem_slug, p.title AS problem_title,
              a.status, a.runtime_ms, a.created_at
       FROM attempts a
       JOIN problems p ON p.id = a.problem_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ?`,
    )
    .all(userId, limit) as RecentAttempt[];
}

export type LatestAttemptInfo = {
  status: string;
  created_at: number;
};

/**
 * Latest attempt per problem for a user. Returns a Map keyed by problem_id
 * containing the most recent attempt's status and created_at timestamp.
 */
export function getLatestAttemptByProblem(
  db: Database.Database,
  userId: number,
): Map<number, LatestAttemptInfo> {
  const rows = db
    .prepare(
      `SELECT a.problem_id, a.status, a.created_at
       FROM attempts a
       JOIN (
         SELECT problem_id, MAX(created_at) AS max_created_at
         FROM attempts
         WHERE user_id = ?
         GROUP BY problem_id
       ) latest
         ON latest.problem_id = a.problem_id
        AND latest.max_created_at = a.created_at
       WHERE a.user_id = ?`,
    )
    .all(userId, userId) as {
    problem_id: number;
    status: string;
    created_at: number;
  }[];
  const map = new Map<number, LatestAttemptInfo>();
  for (const r of rows) {
    map.set(r.problem_id, { status: r.status, created_at: r.created_at });
  }
  return map;
}

/**
 * Day streak = number of consecutive calendar days (in local time, ending today)
 * on which the user made at least one attempt. Today with zero attempts -> 0.
 * Today with attempts but yesterday empty -> 1.
 */
export function getDayStreak(db: Database.Database, userId: number): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT date(created_at, 'unixepoch', 'localtime') AS d
       FROM attempts
       WHERE user_id = ?
       ORDER BY d DESC`,
    )
    .all(userId) as { d: string }[];
  if (rows.length === 0) return 0;
  const days = rows.map((r) => r.d);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (days[0] !== todayStr) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + "T00:00:00");
    const cur = new Date(days[i] + "T00:00:00");
    const diff = Math.round((prev.getTime() - cur.getTime()) / 86_400_000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
