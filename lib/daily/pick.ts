import type Database from "better-sqlite3";
import { getSolvedProblemIds } from "@/lib/stats/repo";
import { dueReviews } from "@/lib/sr/repo";

function hashSeed(userId: number, date: string): number {
  let h = 2166136261 ^ userId;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function pickDaily(db: Database.Database, userId: number, dateISO: string, now: number): number {
  const seed = hashSeed(userId, dateISO);
  const solved = getSolvedProblemIds(db, userId);
  const all = db.prepare(`SELECT id FROM problems ORDER BY id`).all() as { id: number }[];
  const unsolved = all.filter((r) => !solved.has(r.id));
  if (unsolved.length > 0) return unsolved[seed % unsolved.length].id;
  // Everything solved — fall back to a due review, then to anything.
  const due = dueReviews(db, userId, now, 50);
  if (due.length > 0) return due[seed % due.length].problem_id;
  return all[seed % all.length].id;
}
