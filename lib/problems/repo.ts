import type Database from "libsql";
import type { Problem } from "./types";

type Row = Omit<Problem, "test_cases"> & { test_cases_json: string };

function hydrate(row: Row): Problem {
  const { test_cases_json, ...rest } = row;
  return { ...rest, test_cases: JSON.parse(test_cases_json) };
}

/**
 * The catalog is static seed data (~175 KB of markdown and test cases), and
 * against remote Turso every read is a blocking network round-trip. Cache it
 * per connection so the layout, dashboard, and problem pages stop refetching
 * it on every request. Writers (`seedProblems`) call `invalidateProblemCache`.
 */
const catalogCache = new WeakMap<
  Database.Database,
  { list: Problem[]; bySlug: Map<string, Problem> }
>();

function catalog(db: Database.Database) {
  let entry = catalogCache.get(db);
  if (!entry) {
    const list = (
      db
        .prepare(
          "SELECT id, slug, title, difficulty, topic, neetcode_video_url, description_md, starter_code, test_cases_json, editorial_md, method_name FROM problems ORDER BY id",
        )
        .all() as Row[]
    ).map(hydrate);
    entry = { list, bySlug: new Map(list.map((p) => [p.slug, p])) };
    catalogCache.set(db, entry);
  }
  return entry;
}

export function invalidateProblemCache(db: Database.Database): void {
  catalogCache.delete(db);
}

export function listProblems(db: Database.Database): Problem[] {
  return catalog(db).list;
}

export function getProblemBySlug(
  db: Database.Database,
  slug: string,
): Problem | null {
  return catalog(db).bySlug.get(slug) ?? null;
}
