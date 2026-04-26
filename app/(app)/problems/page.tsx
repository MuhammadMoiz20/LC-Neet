import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { getSolvedProblemIds } from "@/lib/stats/repo";
import { requireUserId } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function ProblemsPage() {
  const userId = await requireUserId();
  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Problems</h1>
        <p className="text-sm text-zinc-400">
          {solved.size} / {problems.length} solved
        </p>
      </div>
      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
        {problems.map((p) => (
          <li key={p.id}>
            <Link
              href={`/problem/${p.slug}`}
              className="flex items-center justify-between p-3 hover:bg-zinc-900"
            >
              <span className="flex items-center gap-3">
                <StatusDot solved={solved.has(p.id)} />
                <span>
                  <span className="text-zinc-500 mr-2">{p.id}.</span>
                  {p.title}
                </span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800">
                {p.difficulty}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function StatusDot({ solved }: { solved: boolean }) {
  return (
    <span
      aria-label={solved ? "Solved" : "Unsolved"}
      className={`inline-block h-2 w-2 rounded-full ${
        solved ? "bg-emerald-500" : "bg-zinc-700"
      }`}
    />
  );
}
