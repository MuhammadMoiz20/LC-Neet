export type Grade = 0 | 1 | 2 | 3 | 4 | 5;
const DAY_MS = 86_400_000;

export function nextReview(opts: {
  ease: number; intervalDays: number; grade: Grade; now: number;
}): { ease: number; intervalDays: number; dueAt: number } {
  const { grade, now } = opts;
  let { ease, intervalDays } = opts;
  if (grade < 3) {
    ease = Math.max(1.3, +(ease - 0.32).toFixed(2));
    intervalDays = 1;
  } else {
    ease = Math.max(1.3, +(ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))).toFixed(2));
    intervalDays = intervalDays === 1 ? 6 : Math.round(intervalDays * ease);
  }
  return { ease, intervalDays, dueAt: now + intervalDays * DAY_MS };
}

export function gradeFromAttempt(a: {
  status: "passed" | "failed" | "error";
  attemptCount: number;
  usedHints: boolean;
}): Grade {
  if (a.status === "error") return 0;
  if (a.status === "failed") return 2;
  if (a.attemptCount === 1 && !a.usedHints) return 5;
  return 4;
}
