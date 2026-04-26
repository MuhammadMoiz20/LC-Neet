import type Database from "better-sqlite3";
import { listMistakesForUser, listPatternCounters } from "@/lib/analysis/repo";

export type TopicSlice = { topic: string; solved: number; total: number };
export type DifficultySlice = { difficulty: string; solved: number; total: number };

export function solvedByTopic(
  db: Database.Database,
  userId: number,
): TopicSlice[] {
  const rows = db.prepare(
    `SELECT p.topic AS topic,
            COUNT(DISTINCT p.id) AS total,
            COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN p.id END) AS solved
     FROM problems p
     LEFT JOIN attempts a
       ON a.problem_id = p.id AND a.user_id = ? AND a.status = 'passed'
     GROUP BY p.topic
     ORDER BY p.topic`,
  ).all(userId) as TopicSlice[];
  return rows;
}

export function solvedByDifficulty(
  db: Database.Database,
  userId: number,
): DifficultySlice[] {
  const rows = db.prepare(
    `SELECT p.difficulty AS difficulty,
            COUNT(DISTINCT p.id) AS total,
            COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN p.id END) AS solved
     FROM problems p
     LEFT JOIN attempts a
       ON a.problem_id = p.id AND a.user_id = ? AND a.status = 'passed'
     GROUP BY p.difficulty`,
  ).all(userId) as DifficultySlice[];
  const order: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };
  rows.sort((a, b) => (order[a.difficulty] ?? 99) - (order[b.difficulty] ?? 99));
  return rows;
}

export function recentMistakes(
  db: Database.Database,
  userId: number,
  limit = 20,
) {
  return listMistakesForUser(db, userId, limit);
}

export function patternMastery(db: Database.Database, userId: number) {
  return listPatternCounters(db, userId);
}
