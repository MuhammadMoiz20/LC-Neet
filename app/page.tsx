import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import {
  getSolvedProblemIds,
  getRecentAttempts,
  getDayStreak,
} from "@/lib/stats/repo";
import { requireUserId } from "@/lib/auth/current-user";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await requireUserId();
  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);
  const recent = getRecentAttempts(db, userId, 10);
  const streak = getDayStreak(db, userId);

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <SignOutButton />
      </header>

      <section className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Solved" value={`${solved.size} / ${problems.length}`} />
        <Stat label="Day streak" value={streak.toString()} />
        <Stat label="Recent attempts" value={recent.length === 10 ? "10+" : recent.length.toString()} />
      </section>

      <section className="mb-8">
        <Link
          href="/problems"
          className="inline-block px-4 py-2 rounded bg-white text-black font-medium"
        >
          Browse Problems →
        </Link>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent attempts</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No attempts yet. Pick a problem and run some code.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 border border-zinc-800 rounded">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/problem/${a.problem_slug}`}
                  className="flex items-center justify-between p-3 hover:bg-zinc-900 text-sm"
                >
                  <span>{a.problem_title}</span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={a.status} />
                    <time className="text-zinc-500" dateTime={new Date(a.created_at * 1000).toISOString()}>
                      {timeAgo(a.created_at)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 rounded p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "passed"
      ? "bg-emerald-950 text-emerald-300 border-emerald-900"
      : status === "failed"
        ? "bg-amber-950 text-amber-300 border-amber-900"
        : "bg-red-950 text-red-300 border-red-900";
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>
      {status}
    </span>
  );
}

function timeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
