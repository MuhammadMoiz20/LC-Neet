import type Database from "libsql";
import fs from "node:fs";
import path from "node:path";
import { Problems } from "./problems/types";
import { invalidateProblemCache, listProblems } from "./problems/repo";

// The columns the upsert below writes (slug is fixed at insert).
const SEEDED_FIELDS = [
  "title",
  "difficulty",
  "topic",
  "neetcode_video_url",
  "description_md",
  "starter_code",
  "test_cases",
  "editorial_md",
  "method_name",
] as const;

export function seedProblems(db: Database.Database) {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "lib/problems/neetcode150.json"),
    "utf8",
  );
  const problems = Problems.parse(JSON.parse(raw));

  // Against remote Turso every upsert is a network round-trip and this runs on
  // every cold start, so write only the rows that differ from what is stored.
  // The one read it costs also warms the catalog cache for the first request.
  const stored = new Map(listProblems(db).map((p) => [p.id, p]));
  const changed = problems.filter((p) => {
    const cur = stored.get(p.id);
    return (
      !cur ||
      SEEDED_FIELDS.some((k) => JSON.stringify(cur[k]) !== JSON.stringify(p[k]))
    );
  });
  if (changed.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO problems (id, slug, title, difficulty, topic, neetcode_video_url,
                          description_md, starter_code, test_cases_json, editorial_md, method_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      difficulty=excluded.difficulty,
      topic=excluded.topic,
      neetcode_video_url=excluded.neetcode_video_url,
      description_md=excluded.description_md,
      starter_code=excluded.starter_code,
      test_cases_json=excluded.test_cases_json,
      editorial_md=excluded.editorial_md,
      method_name=excluded.method_name
  `);
  const tx = db.transaction((rows: typeof problems) => {
    for (const p of rows) {
      stmt.run(
        p.id,
        p.slug,
        p.title,
        p.difficulty,
        p.topic,
        p.neetcode_video_url,
        p.description_md,
        p.starter_code,
        JSON.stringify(p.test_cases),
        p.editorial_md,
        p.method_name,
      );
    }
  });
  tx(changed);
  invalidateProblemCache(db);
}
