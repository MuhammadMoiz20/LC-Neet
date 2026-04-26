import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import {
  getLatestAttemptByProblem,
  getSolvedProblemIds,
} from "@/lib/stats/repo";
import { requireUserId } from "@/lib/auth/current-user";
import {
  getPatternName,
  topicToPatternId,
} from "@/lib/patterns/groups";
import {
  ProblemsBrowser,
  type ProblemRow,
} from "@/components/problems/problems-browser";

export const dynamic = "force-dynamic";

function lastAttemptLabel(
  status: "solved" | "attempted" | "todo",
  rawStatus: string | undefined,
): string {
  if (status === "solved") return "· accepted";
  if (status === "attempted") {
    if (!rawStatus) return "· attempted";
    return rawStatus === "passed" ? "· accepted" : `· ${rawStatus}`;
  }
  return "—";
}

export default async function ProblemsPage() {
  const userId = await requireUserId();
  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);
  const latest = getLatestAttemptByProblem(db, userId);

  const rows: ProblemRow[] = problems.map((p) => {
    const isSolved = solved.has(p.id);
    const last = latest.get(p.id);
    const status: ProblemRow["status"] = isSolved
      ? "solved"
      : last
        ? "attempted"
        : "todo";
    const patternId = topicToPatternId(p.topic);
    return {
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      patternId,
      patternName: getPatternName(patternId),
      status,
      lastAttemptLabel: lastAttemptLabel(status, last?.status),
    };
  });

  return <ProblemsBrowser rows={rows} />;
}
