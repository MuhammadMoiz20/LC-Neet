"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import {
  recordAttempt,
  listAttempts,
  type Attempt,
  type AttemptStatus,
} from "@/lib/attempts/repo";
import { upsertReview, getReviewState } from "@/lib/sr/repo";
import { nextReview, gradeFromAttempt } from "@/lib/sr/sm2";
import { getDaily, markDailyComplete } from "@/lib/daily/repo";
import { endOfLocalDay, localDate, userTzOffsetSec } from "@/lib/time/local-day";

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
  const db = getDb();
  const attemptId = recordAttempt(db, {
    user_id: userId,
    problem_id: input.problemId,
    code: input.code,
    status: input.status,
    runtime_ms: input.runtimeMs,
    mode: input.mode,
  });

  if (input.status === "passed") {
    // Counts only — the rows themselves carry full code and chat text.
    const { attemptCount, chatCount } = db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM attempts WHERE user_id = ? AND problem_id = ?) AS attemptCount,
                (SELECT COUNT(*) FROM chat_messages WHERE user_id = ? AND problem_id = ?) AS chatCount`,
      )
      .get(userId, input.problemId, userId, input.problemId) as {
      attemptCount: number;
      chatCount: number;
    };
    const usedHints = chatCount > 0;
    const grade = gradeFromAttempt({
      status: "passed",
      attemptCount,
      usedHints,
    });
    const prev = getReviewState(db, userId, input.problemId);
    const tz = await userTzOffsetSec();
    // A pass counts as a review only once the problem is due again (any time
    // on its due day). Resubmitting before then must not walk it toward "mastered".
    if (!prev || prev.due_at <= endOfLocalDay(Date.now(), tz)) {
      const nr = nextReview({
        ease: prev?.ease ?? 2.5,
        intervalDays: prev?.interval_days ?? 1,
        grade,
        now: Date.now(),
      });
      upsertReview(db, {
        user_id: userId,
        problem_id: input.problemId,
        due_at: nr.dueAt,
        ease: nr.ease,
        interval_days: nr.intervalDays,
      });
    }

    const today = localDate(Date.now(), tz);
    const daily = getDaily(db, userId, today);
    if (daily && daily.problem_id === input.problemId && !daily.completed) {
      markDailyComplete(db, userId, today);
    }
  }

  // An attempt changes the dashboard, the problem list and the board; without
  // this, pressing Back shows the copy the router cached before the attempt.
  revalidatePath("/", "layout");
  return attemptId;
}

export async function getMyAttempts(problemId: number): Promise<Attempt[]> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = Number(session.user.id);
  return listAttempts(getDb(), userId, problemId);
}
