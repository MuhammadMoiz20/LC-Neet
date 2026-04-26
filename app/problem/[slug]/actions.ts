"use server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { recordAttempt, type AttemptStatus } from "@/lib/attempts/repo";

export async function submitAttempt(input: {
  problemId: number;
  code: string;
  status: AttemptStatus;
  runtimeMs: number | null;
  mode: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = Number(session.user.id);
  return recordAttempt(getDb(), {
    user_id: userId,
    problem_id: input.problemId,
    code: input.code,
    status: input.status,
    runtime_ms: input.runtimeMs,
    mode: input.mode,
  });
}
