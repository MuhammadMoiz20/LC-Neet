import { requireUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { getByAttempt } from "@/lib/analysis/repo";
import { notFound } from "next/navigation";
import { AnalysisView } from "./analysis-view";

export const dynamic = "force-dynamic";

type AttemptCtxRow = {
  id: number;
  problem_id: number;
  status: "passed" | "failed" | "error";
  runtime_ms: number | null;
  created_at: number;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
};

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const userId = await requireUserId();
  const { attemptId } = await params;
  const id = Number(attemptId);
  if (!Number.isFinite(id)) notFound();
  const db = getDb();
  const ctx = db
    .prepare(
      `SELECT a.id, a.problem_id, a.status, a.runtime_ms, a.created_at,
              p.slug, p.title, p.difficulty, p.topic
       FROM attempts a JOIN problems p ON p.id = a.problem_id
       WHERE a.id = ? AND a.user_id = ?`,
    )
    .get(id, userId) as AttemptCtxRow | undefined;
  if (!ctx) notFound();
  const initial = getByAttempt(db, id);
  return (
    <AnalysisView
      attemptId={id}
      problemId={ctx.problem_id}
      problemSlug={ctx.slug}
      problemTitle={ctx.title}
      attemptStatus={ctx.status}
      runtimeMs={ctx.runtime_ms}
      createdAt={ctx.created_at}
      initial={initial}
    />
  );
}
