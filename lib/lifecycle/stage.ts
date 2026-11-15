export type Stage = "todo" | "attempting" | "revisit" | "solved" | "mastered";

export const STAGES: readonly { id: Stage; name: string; blurb: string }[] = [
  { id: "todo", name: "Not started", blurb: "You haven't opened it yet." },
  { id: "attempting", name: "Attempting", blurb: "Opened or tried, not accepted yet." },
  { id: "revisit", name: "Revisit", blurb: "Marked by you, or due for review now." },
  { id: "solved", name: "Solved", blurb: "Accepted. The next review is scheduled." },
  { id: "mastered", name: "Mastered", blurb: "Held up across reviews: the next one is 3+ weeks out." },
];

// The interval at which Anki calls a card "mature".
export const MASTERY_INTERVAL_DAYS = 21;

// Mastery also needs accepted passes on this many separate days. Schedules
// written before passes were gated on being due could reach 21 days in one sitting.
export const MASTERY_MIN_PASS_DAYS = 3;

export function problemStage(
  p: {
    attempted: boolean;
    solved: boolean;
    review: { due_at: number; interval_days: number } | null;
  },
  nowMs: number,
): Stage {
  const r = p.review;
  // An accepted submission never schedules less than 6 days, so interval 1 only means "flagged".
  if (r && (r.due_at <= nowMs || r.interval_days <= 1)) return "revisit";
  if (!p.attempted) return "todo";
  if (!p.solved) return "attempting";
  if (r && r.interval_days >= MASTERY_INTERVAL_DAYS) return "mastered";
  return "solved";
}

/**
 * Does this column agree with the problem's history? The board lets a card go
 * anywhere; when the answer here is no, the move is kept as a pin instead of
 * being expressed through the "opened" record or the review schedule.
 */
export function fitsHistory(
  p: { attempted: boolean; submitted: boolean; solved: boolean; passDays: number },
  to: Stage,
): boolean {
  if (to === "todo") return !p.submitted;
  if (to === "attempting") return !p.solved;
  if (to === "revisit") return p.attempted;
  if (to === "solved") return p.solved;
  return p.solved && p.passDays >= MASTERY_MIN_PASS_DAYS;
}
