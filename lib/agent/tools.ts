import type Database from "better-sqlite3";

export type ProblemMeta = {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  topic: string;
  description_excerpt: string;
};

export type HistoryItem = {
  slug: string;
  title: string;
  status: string;
  created_at: number;
};

export function getProblemMeta(
  db: Database.Database,
  problemId: number,
): ProblemMeta | null {
  const row = db
    .prepare(
      `SELECT id, slug, title, difficulty, topic, description_md
       FROM problems WHERE id = ?`,
    )
    .get(problemId) as
    | {
        id: number;
        slug: string;
        title: string;
        difficulty: string;
        topic: string;
        description_md: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    difficulty: row.difficulty,
    topic: row.topic,
    description_excerpt: row.description_md.slice(0, 500),
  };
}

export function getUserHistory(
  db: Database.Database,
  userId: number,
  topic: string,
  limit: number,
): HistoryItem[] {
  return db
    .prepare(
      `SELECT p.slug AS slug, p.title AS title, a.status AS status, a.created_at AS created_at
       FROM attempts a
       JOIN problems p ON p.id = a.problem_id
       WHERE a.user_id = ? AND p.topic = ?
       ORDER BY a.created_at DESC
       LIMIT ?`,
    )
    .all(userId, topic, limit) as HistoryItem[];
}
