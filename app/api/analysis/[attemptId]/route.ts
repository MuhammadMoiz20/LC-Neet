import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth/current-user";
import { getByAttempt } from "@/lib/analysis/repo";
import { runPipeline } from "@/lib/analysis/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AttemptCtx = {
  id: number;
  user_id: number;
  problem_id: number;
  code: string;
  title: string;
  topic: string;
  difficulty: string;
  description_md: string;
};

function loadCtx(
  db: ReturnType<typeof getDb>,
  attemptId: number,
  userId: number,
): AttemptCtx | undefined {
  return db
    .prepare(
      `SELECT a.id, a.user_id, a.problem_id, a.code,
              p.title, p.topic, p.difficulty, p.description_md
       FROM attempts a JOIN problems p ON p.id = a.problem_id
       WHERE a.id = ? AND a.user_id = ?`,
    )
    .get(attemptId, userId) as AttemptCtx | undefined;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const userId = await requireUserId();
  const { attemptId } = await params;
  const id = Number(attemptId);
  if (!Number.isFinite(id)) {
    return new Response("bad attemptId", { status: 400 });
  }
  const db = getDb();
  if (!loadCtx(db, id, userId)) {
    return new Response("not found", { status: 404 });
  }
  return Response.json({ rows: getByAttempt(db, id) });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const userId = await requireUserId();
  const { attemptId } = await params;
  const id = Number(attemptId);
  if (!Number.isFinite(id)) {
    return new Response("bad attemptId", { status: 400 });
  }
  const db = getDb();
  const ctx = loadCtx(db, id, userId);
  if (!ctx) {
    return new Response("not found", { status: 404 });
  }

  void runPipeline(db, {
    attemptId: id,
    userId,
    problemId: ctx.problem_id,
    code: ctx.code,
    problemTitle: ctx.title,
    problemTopic: ctx.topic,
    problemDifficulty: ctx.difficulty,
    problemDescription: ctx.description_md,
  });

  return Response.json({ rows: getByAttempt(db, id) });
}
