import type Database from "better-sqlite3";
import { getSolvedProblemIds } from "@/lib/stats/repo";
import { dueReviews } from "@/lib/sr/repo";

function hashSeed(userId: number, date: string): number {
  let h = 2166136261 ^ userId;
  for (let i = 0; i < date.length; i++) h = Math.imul(h ^ date.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function pickDaily(db: Database.Database, userId: number, dateISO: string, now: number): number {
  const due = dueReviews(db, userId, now, 50);
  const seed = hashSeed(userId, dateISO);
  if (due.length > 0) return due[seed % due.length].problem_id;
  const solved = getSolvedProblemIds(db, userId);
  const all = db.prepare(`SELECT id FROM problems ORDER BY id`).all() as { id: number }[];
  const unsolved = all.filter((r) => !solved.has(r.id));
  const pool = unsolved.length > 0 ? unsolved : all;
  return pool[seed % pool.length].id;
}
