import type Database from "libsql";
import { localDate, serverTzOffsetSec } from "@/lib/time/local-day";

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
 * Streaks count consecutive calendar days (on the user's clock) with at least
 * one attempt. current = the run ending today (0 if no attempt today);
 * best = the longest run anywhere in history.
 */
export function getStreaks(
  db: Database.Database,
  userId: number,
  tzOffsetSec = serverTzOffsetSec(),
): { current: number; best: number } {
  const rows = db
    .prepare(
      `SELECT DISTINCT date(created_at + ?, 'unixepoch') AS d
       FROM attempts
       WHERE user_id = ?
       ORDER BY d DESC`,
    )
    .all(tzOffsetSec, userId) as { d: string }[];
  const days = rows.map((r) => r.d);
  const startsToday = days[0] === localDate(Date.now(), tzOffsetSec);
  let current = 0;
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    const gap =
      i > 0
        ? Date.parse(days[i - 1] + "T00:00:00Z") - Date.parse(days[i] + "T00:00:00Z")
        : 0;
    run = gap === 86_400_000 ? run + 1 : 1;
    if (run > best) best = run;
    // run === i + 1 means no gap yet: still inside the newest run.
    if (startsToday && run === i + 1) current = run;
  }
  return { current, best };
}

export function getDayStreak(
  db: Database.Database,
  userId: number,
  tzOffsetSec = serverTzOffsetSec(),
): number {
  return getStreaks(db, userId, tzOffsetSec).current;
}
