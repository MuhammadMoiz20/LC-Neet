import type Database from "better-sqlite3";

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;
export type HeatmapDay = { level: HeatmapLevel; count: number };

const DAY_MS = 86_400_000;

function toLocalDateStr(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function levelFor(count: number): HeatmapLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * Build a 182-day (26-week) heatmap, oldest -> newest, ending on the local day
 * containing `todayUnix` (seconds since epoch).
 */
export function buildHeatmap(
  db: Database.Database,
  userId: number,
  todayUnix: number,
): HeatmapDay[] {
  const todayMs = todayUnix * 1000;
  const startMs = todayMs - 181 * DAY_MS;
  const startUnix = Math.floor(startMs / 1000);

  const rows = db
    .prepare(
      `SELECT date(created_at, 'unixepoch', 'localtime') AS d, COUNT(*) AS c
       FROM attempts
       WHERE user_id = ? AND created_at >= ?
       GROUP BY d`,
    )
    .all(userId, startUnix) as { d: string; c: number }[];

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.d, r.c);

  const days: HeatmapDay[] = [];
  for (let i = 0; i < 182; i++) {
    const ms = startMs + i * DAY_MS;
    const key = toLocalDateStr(ms);
    const count = counts.get(key) ?? 0;
    days.push({ level: levelFor(count), count });
  }
  return days;
}
