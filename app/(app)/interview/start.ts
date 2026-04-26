"use server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { getSolvedProblemIds } from "@/lib/stats/repo";
import { topicToPatternId } from "@/lib/patterns/groups";

const ALLOWED_DURATIONS = new Set([30, 45, 60, 90]);
const ALLOWED_DIFFICULTIES = new Set(["Easy", "Medium", "Hard", "Mixed"]);

export async function startInterview(formData?: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = Number(session.user.id);

  const rawDuration = Number(formData?.get("duration") ?? 30);
  const duration = ALLOWED_DURATIONS.has(rawDuration) ? rawDuration : 30;
  const rawDifficulty = String(formData?.get("difficulty") ?? "Medium");
  const difficulty = ALLOWED_DIFFICULTIES.has(rawDifficulty)
    ? rawDifficulty
    : "Medium";
  const topic = String(formData?.get("topic") ?? "mixed");

  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);
  const unsolved = problems.filter((p) => !solved.has(p.id));

  let pool = unsolved.filter((p) => {
    if (difficulty !== "Mixed" && p.difficulty !== difficulty) return false;
    if (topic !== "mixed" && topicToPatternId(p.topic) !== topic) return false;
    return true;
  });
  if (pool.length === 0) pool = unsolved;
  if (pool.length === 0) pool = problems;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  redirect(`/problem/${pick.slug}?focus=1&duration=${duration}`);
}
