import type Database from "better-sqlite3";
import type { Problem } from "./types";

type Row = Omit<Problem, "test_cases"> & { test_cases_json: string };

function hydrate(row: Row): Problem {
  const { test_cases_json, ...rest } = row;
  return { ...rest, test_cases: JSON.parse(test_cases_json) };
}

export function listProblems(db: Database.Database): Problem[] {
  const rows = db
    .prepare(
      "SELECT id, slug, title, difficulty, topic, neetcode_video_url, description_md, starter_code, test_cases_json, editorial_md, method_name FROM problems ORDER BY id",
    )
    .all() as Row[];
  return rows.map(hydrate);
}

export function getProblemBySlug(
  db: Database.Database,
  slug: string,
): Problem | null {
  const row = db
    .prepare(
      "SELECT id, slug, title, difficulty, topic, neetcode_video_url, description_md, starter_code, test_cases_json, editorial_md, method_name FROM problems WHERE slug = ?",
    )
    .get(slug) as Row | undefined;
  return row ? hydrate(row) : null;
}
