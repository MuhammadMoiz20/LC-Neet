import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";

export default function ProblemsPage() {
  const problems = listProblems(getDb());
  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Problems</h1>
      <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
        {problems.map((p) => (
          <li key={p.id}>
            <Link
              href={`/problem/${p.slug}`}
              className="flex items-center justify-between p-3 hover:bg-zinc-900"
            >
              <span>
                <span className="text-zinc-500 mr-2">{p.id}.</span>
                {p.title}
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
