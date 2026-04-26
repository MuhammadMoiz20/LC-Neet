import { requireUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import {
  solvedByTopic,
  solvedByDifficulty,
  recentMistakes,
  patternMastery,
} from "@/lib/stats/aggregate";
import { dueReviews } from "@/lib/sr/repo";
import { listProblems } from "@/lib/problems/repo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const userId = await requireUserId();
  const db = getDb();
  const topic = solvedByTopic(db, userId);
  const diff = solvedByDifficulty(db, userId);
  const mistakes = recentMistakes(db, userId, 20);
  const mastery = patternMastery(db, userId);
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const due = dueReviews(db, userId, now, 20);
  const problems = listProblems(db);
  const slugById = new Map(problems.map((p) => [p.id, p.slug] as const));
  const titleById = new Map(problems.map((p) => [p.id, p.title] as const));

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Stats</h1>

      <section>
        <h2 className="text-lg font-semibold mb-3">Solved by topic</h2>
        <Bars
          rows={topic.map((r) => ({
            label: r.topic,
            solved: r.solved,
            total: r.total,
          }))}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Solved by difficulty</h2>
        <Bars
          rows={diff.map((r) => ({
            label: r.difficulty,
            solved: r.solved,
            total: r.total,
          }))}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent mistakes</h2>
        {mistakes.length === 0 ? (
          <p className="text-sm text-zinc-500">No mistakes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
            {mistakes.map((m) => (
              <li key={m.id} className="p-3 text-sm">
                <span className="text-xs uppercase tracking-wide text-zinc-500 mr-2">
                  {m.category}
                </span>
                {m.note}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Pattern mastery</h2>
        {mastery.length === 0 ? (
          <p className="text-sm text-zinc-500">No patterns identified yet.</p>
        ) : (
          <ul className="space-y-1">
            {mastery.map((p) => (
              <li
                key={p.pattern}
                className="text-sm flex justify-between"
              >
                <span>{p.pattern}</span>
                <span className="text-zinc-500">{p.solved_count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Due reviews</h2>
        {due.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing due right now.</p>
        ) : (
          <ul className="space-y-1">
            {due.map((d) => {
              const slug = slugById.get(d.problem_id);
              const title = titleById.get(d.problem_id) ?? `Problem ${d.problem_id}`;
              return (
                <li key={d.id} className="text-sm">
                  {slug ? (
                    <Link href={`/problem/${slug}`} className="hover:underline">
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Bars({
  rows,
}: {
  rows: { label: string; solved: number; total: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 text-zinc-300">{r.label}</span>
          <div className="flex-1 h-2 bg-zinc-900 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(r.solved / max) * 100}%` }}
            />
          </div>
          <span className="w-16 text-right text-zinc-500">
            {r.solved} / {r.total}
          </span>
        </div>
      ))}
    </div>
  );
}
