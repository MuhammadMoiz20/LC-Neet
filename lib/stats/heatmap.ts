import type Database from "libsql";
import { localDate, serverTzOffsetSec } from "@/lib/time/local-day";

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;
export type HeatmapDay = { level: HeatmapLevel; count: number };

const DAY_MS = 86_400_000;

function levelFor(count: number): HeatmapLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * Build a 182-day (26-week) heatmap, oldest -> newest, ending on the day (on
 * the user's clock) containing `todayUnix` (seconds since epoch).
 */
export function buildHeatmap(
  db: Database.Database,
  userId: number,
  todayUnix: number,
  tzOffsetSec = serverTzOffsetSec(),
): HeatmapDay[] {
  const todayMs = todayUnix * 1000;
  const startMs = todayMs - 181 * DAY_MS;
  const startUnix = Math.floor(startMs / 1000);

  const rows = db
    .prepare(
      `SELECT date(created_at + ?, 'unixepoch') AS d, COUNT(*) AS c
       FROM attempts
       WHERE user_id = ? AND created_at >= ?
       GROUP BY d`,
    )
    .all(tzOffsetSec, userId, startUnix) as { d: string; c: number }[];

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.d, r.c);

  const days: HeatmapDay[] = [];
  for (let i = 0; i < 182; i++) {
    const ms = startMs + i * DAY_MS;
    const key = localDate(ms, tzOffsetSec);
    const count = counts.get(key) ?? 0;
    days.push({ level: levelFor(count), count });
  }
  return days;
}
