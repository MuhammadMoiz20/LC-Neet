import { describe, expect, test } from "vitest";
import { MASTERY_INTERVAL_DAYS, STAGES, problemStage, fitsHistory } from "./stage";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;
const review = (dueInDays: number, interval_days: number) => ({
  due_at: NOW + dueInDays * DAY,
  interval_days,
});

describe("problemStage", () => {
  test("flagged (interval 1, due tomorrow) is revisit even when never solved or attempted", () => {
    expect(problemStage({ attempted: true, solved: false, review: review(1, 1) }, NOW)).toBe("revisit");
    expect(problemStage({ attempted: false, solved: false, review: review(1, 1) }, NOW)).toBe("revisit");
  });

  test("a due review is revisit, and beats mastered", () => {
    expect(problemStage({ attempted: true, solved: true, review: review(0, 6) }, NOW)).toBe("revisit");
    expect(problemStage({ attempted: true, solved: true, review: review(-3, 40) }, NOW)).toBe("revisit");
  });

  test("no attempts is todo", () => {
    expect(problemStage({ attempted: false, solved: false, review: null }, NOW)).toBe("todo");
  });

  test("attempted but never accepted is attempting", () => {
    expect(problemStage({ attempted: true, solved: false, review: null }, NOW)).toBe("attempting");
  });

  test("interval exactly at the threshold is mastered, one day short is solved", () => {
    const at = { attempted: true, solved: true, review: review(10, MASTERY_INTERVAL_DAYS) };
    const below = { attempted: true, solved: true, review: review(10, MASTERY_INTERVAL_DAYS - 1) };
    expect(problemStage(at, NOW)).toBe("mastered");
    expect(problemStage(below, NOW)).toBe("solved");
  });

  test("solved with no review row is solved", () => {
    expect(problemStage({ attempted: true, solved: true, review: null }, NOW)).toBe("solved");
  });

  test("STAGES lists the lifecycle in order", () => {
    expect(STAGES.map((s) => s.id)).toEqual(["todo", "attempting", "revisit", "solved", "mastered"]);
  });
});

describe("fitsHistory", () => {
  const opened = { attempted: true, submitted: false, solved: false, passDays: 0 };
  const failed = { attempted: true, submitted: true, solved: false, passDays: 0 };
  const solved = { attempted: true, submitted: true, solved: true, passDays: 1 };
  const untouched = { attempted: false, submitted: false, solved: false, passDays: 0 };

  test("Not started fits only a problem with no submissions", () => {
    expect(fitsHistory(opened, "todo")).toBe(true);
    expect(fitsHistory(failed, "todo")).toBe(false);
  });
  test("Attempting fits anything not yet accepted", () => {
    expect(fitsHistory(untouched, "attempting")).toBe(true);
    expect(fitsHistory(solved, "attempting")).toBe(false);
  });
  test("Revisit fits a started problem; Solved fits an accepted one", () => {
    expect(fitsHistory(untouched, "revisit")).toBe(false);
    expect(fitsHistory(opened, "revisit")).toBe(true);
    expect(fitsHistory(failed, "solved")).toBe(false);
    expect(fitsHistory(solved, "solved")).toBe(true);
  });
  test("Mastered fits only passes on three separate days", () => {
    expect(fitsHistory(solved, "mastered")).toBe(false);
    expect(fitsHistory({ ...solved, passDays: 3 }, "mastered")).toBe(true);
  });
});
