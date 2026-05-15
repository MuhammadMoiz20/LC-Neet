import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import {
  getSolvedProblemIds,
  getRecentAttempts,
  getDayStreak,
} from "@/lib/stats/repo";
import { requireUserId } from "@/lib/auth/current-user";
import { getOrCreateDaily } from "@/lib/daily/repo";
import { pickDaily } from "@/lib/daily/pick";
import { dueReviews } from "@/lib/sr/repo";
import {
  PATTERN_GROUPS,
  getPatternName,
  topicToPatternId,
} from "@/lib/patterns/groups";
import { buildHeatmap } from "@/lib/stats/heatmap";
import { getWeakPatterns } from "@/lib/stats/weak-patterns";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import type { Problem } from "@/lib/problems/types";

export const dynamic = "force-dynamic";

function timeAgo(unixSec: number, nowSec: number): string {
  const diff = Math.max(0, nowSec - unixSec);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 2) return "yesterday";
  return `${Math.floor(diff / 86400)}d ago`;
}

function greetingTimeOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getUTCHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function nameFromEmail(email: string | null | undefined): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? email;
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function statusVerdict(status: string): "Accepted" | "Wrong" | string {
  if (status === "passed") return "Accepted";
  if (status === "failed") return "Wrong";
  return status;
}

function takeawayFor(status: string, title: string): string {
  if (status === "passed")
    return `Clean run on ${title} — try a one-pass refactor.`;
  if (status === "failed")
    return `Re-derive the invariant for ${title} before retrying.`;
  return `Inspect the trace for ${title}.`;
}

export default async function Home() {
  const userId = await requireUserId();
  const session = await auth();
  const email = session?.user?.email ?? null;

  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);
  const recent = getRecentAttempts(db, userId, 12);
  const streakCount = getDayStreak(db, userId);

  // Server component: Date.now() is intentionally per-request (not a hook).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  const today = new Date(now).toISOString().slice(0, 10);
  const daily = getOrCreateDaily(db, userId, today, () =>
    pickDaily(db, userId, today, now),
  );
  // If today's daily was assigned a problem the user has since solved, swap
  // in a fresh unsolved pick so the hero never points at finished work.
  if (solved.has(daily.problem_id)) {
    const newPid = pickDaily(db, userId, today, now);
    if (newPid !== daily.problem_id && !solved.has(newPid)) {
      db.prepare(
        `UPDATE daily SET problem_id = ?, completed = 0 WHERE user_id = ? AND date = ?`,
      ).run(newPid, userId, today);
      daily.problem_id = newPid;
      daily.completed = 0;
    } else {
      daily.completed = 1;
    }
  }
  const dailyProblem = problems.find((p) => p.id === daily.problem_id);
  const due = dueReviews(db, userId, now, 5);

  const problemById = new Map<number, Problem>(problems.map((p) => [p.id, p]));

  // Pattern progress: count distinct solved problem ids per pattern.
  const solvedByPattern = new Map<string, number>();
  for (const pid of solved) {
    const p = problemById.get(pid);
    if (!p) continue;
    const id = topicToPatternId(p.topic);
    solvedByPattern.set(id, (solvedByPattern.get(id) ?? 0) + 1);
  }
  const patternRailItems = PATTERN_GROUPS.map((g) => ({
    id: g.id,
    name: g.name,
    total: g.total,
    solved: Math.min(g.total, solvedByPattern.get(g.id) ?? 0),
  }));

  // Heatmap.
  const heatmap = buildHeatmap(db, userId, nowSec);

  // Recent analyses (always link to /analysis/[attemptId]).
  const recentItems = recent.map((a) => ({
    id: a.id,
    slug: a.problem_slug,
    name: a.problem_title,
    verdict: statusVerdict(a.status),
    runtimeMs: a.runtime_ms,
    whenAgo: timeAgo(a.created_at, nowSec),
    takeaway: takeawayFor(a.status, a.problem_title),
  }));

  // Weak patterns.
  const weak = getWeakPatterns(db, userId);

  // Do next: prefer daily (if exists & not completed), then due review, then unsolved.
  type DoNextResolved = {
    problem: Problem;
    why: string;
    spaced: string;
  };
  let doNext: DoNextResolved | null = null;
  if (dailyProblem && !daily.completed) {
    doNext = {
      problem: dailyProblem,
      why: "Today's daily challenge — focus on consistency.",
      spaced: "today",
    };
  } else if (due.length > 0) {
    const r = due[0];
    if (r) {
      const p = problemById.get(r.problem_id);
      if (p) {
        const days = Math.max(
          1,
          Math.floor((nowSec - r.due_at) / 86400) + r.interval_days,
        );
        doNext = {
          problem: p,
          why: "Spaced repetition: due for review.",
          spaced: `${days}d since last try`,
        };
      }
    }
  }
  if (!doNext) {
    // Try the weakest pattern's first unsolved problem.
    const weakestId = weak[0]?.pattern;
    const unsolvedInWeak = weakestId
      ? problems.find(
          (p) =>
            !solved.has(p.id) && topicToPatternId(p.topic) === weakestId,
        )
      : undefined;
    const fallback = unsolvedInWeak ?? problems.find((p) => !solved.has(p.id));
    if (fallback) {
      const patName = getPatternName(topicToPatternId(fallback.topic));
      doNext = {
        problem: fallback,
        why: `First unsolved in your weakest pattern: ${patName}.`,
        spaced: "fresh",
      };
    } else if (problems.length > 0) {
      const p = problems[0]!;
      doNext = {
        problem: p,
        why: "Revisit a solved problem and try a tighter solution.",
        spaced: "review",
      };
    }
  }

  // Last attempt for the do-next problem (for the side stat card).
  let lastAttempt: { whenAgo: string; verdict: string } | undefined;
  let accuracy: number | undefined;
  if (doNext) {
    const last = recent.find((a) => a.problem_id === doNext!.problem.id);
    if (last) {
      lastAttempt = {
        whenAgo: timeAgo(last.created_at, nowSec),
        verdict: statusVerdict(last.status),
      };
    }
    const patternId = topicToPatternId(doNext.problem.topic);
    const patAttempts = recent.filter((a) => {
      const p = problemById.get(a.problem_id);
      return p && topicToPatternId(p.topic) === patternId;
    });
    if (patAttempts.length > 0) {
      const passed = patAttempts.filter((a) => a.status === "passed").length;
      accuracy = passed / patAttempts.length;
    }
  }

  const doNextProps = doNext
    ? {
        slug: doNext.problem.slug,
        name: doNext.problem.title,
        difficulty: doNext.problem.difficulty,
        patternName: getPatternName(topicToPatternId(doNext.problem.topic)),
        spaced: doNext.spaced,
        est: "~22 min",
        why: doNext.why,
        lastAttempt,
        accuracy,
        queueLabel: due.length > 0 ? `queue · 1 of ${due.length}` : undefined,
      }
    : {
        slug: "",
        name: "Add a problem to begin",
        difficulty: "Easy" as const,
        patternName: "Arrays & Hashing",
        spaced: "—",
        est: "—",
        why: "Seed problems first, then come back.",
      };

  // Resume card: most recent failed/running attempt within last 24h.
  const dayAgo = nowSec - 86400;
  const resumeRow = recent.find(
    (a) =>
      a.created_at >= dayAgo &&
      (a.status === "failed" || a.status === "running"),
  );
  const resumeProblem = resumeRow ? problemById.get(resumeRow.problem_id) : undefined;
  const resumeProps = resumeProblem
    ? {
        slug: resumeProblem.slug,
        name: resumeProblem.title,
        difficulty: resumeProblem.difficulty,
        patternName: getPatternName(topicToPatternId(resumeProblem.topic)),
        elapsed: undefined,
        lastEditAgo: resumeRow ? timeAgo(resumeRow.created_at, nowSec) : undefined,
      }
    : {};

  // Streak: today flag = there is at least one attempt today.
  const todayLocalStr = new Date().toLocaleDateString("en-CA");
  const hasAttemptToday = recent.some((a) => {
    const d = new Date(a.created_at * 1000).toLocaleDateString("en-CA");
    return d === todayLocalStr;
  });

  return (
    <DashboardView
      greetingName={nameFromEmail(email)}
      greetingTime={greetingTimeOfDay()}
      totalSolved={solved.size}
      totalProblems={150}
      patterns={patternRailItems}
      doNext={doNextProps}
      heatmap={heatmap}
      recent={recentItems}
      streak={{
        current: streakCount,
        best: Math.max(streakCount, 0),
        today: hasAttemptToday,
      }}
      resume={resumeProps}
      weak={weak}
    />
  );
}
