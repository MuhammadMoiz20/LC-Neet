import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { Problems } from "./problems/types";

export function seedProblems(db: Database.Database) {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "lib/problems/neetcode150.json"),
    "utf8",
  );
  const problems = Problems.parse(JSON.parse(raw));
  const stmt = db.prepare(`
    INSERT INTO problems (id, slug, title, difficulty, topic, neetcode_video_url,
                          description_md, starter_code, test_cases_json, editorial_md, method_name)
    VALUES (@id, @slug, @title, @difficulty, @topic, @neetcode_video_url,
            @description_md, @starter_code, @test_cases_json, @editorial_md, @method_name)
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
      stmt.run({
        id: p.id,
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        topic: p.topic,
        neetcode_video_url: p.neetcode_video_url,
        description_md: p.description_md,
        starter_code: p.starter_code,
        test_cases_json: JSON.stringify(p.test_cases),
        editorial_md: p.editorial_md,
        method_name: p.method_name,
      });
    }
  });
  tx(problems);
}
