"use server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { listProblems } from "@/lib/problems/repo";
import { getSolvedProblemIds } from "@/lib/stats/repo";

export async function startInterview() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = Number(session.user.id);
  const db = getDb();
  const problems = listProblems(db);
  const solved = getSolvedProblemIds(db, userId);
  const unsolved = problems.filter((p) => !solved.has(p.id));
  const pool = unsolved.length > 0 ? unsolved : problems;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  redirect(`/problem/${pick.slug}?mode=interview&duration=30`);
}
