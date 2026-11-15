import { describe, expect, test } from "vitest";
import { MASTERY_INTERVAL_DAYS, STAGES, problemStage, moveRefusal } from "./stage";

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

describe("moveRefusal", () => {
  const facts = { attempted: true, solved: true, passDays: 1 };
  test("never allows a drop on the columns that follow submissions", () => {
    expect(moveRefusal(facts, "todo")).toBeTruthy();
    expect(moveRefusal(facts, "attempting")).toBeTruthy();
  });
  test("Revisit needs an attempt; Solved needs an accepted pass", () => {
    expect(moveRefusal({ attempted: false, solved: false, passDays: 0 }, "revisit")).toBeTruthy();
    expect(moveRefusal({ attempted: true, solved: false, passDays: 0 }, "revisit")).toBeNull();
    expect(moveRefusal({ attempted: true, solved: false, passDays: 0 }, "solved")).toBeTruthy();
    expect(moveRefusal(facts, "solved")).toBeNull();
  });
  test("Mastered has to be earned on three separate days", () => {
    expect(moveRefusal(facts, "mastered")).toMatch(/1 so far/);
    expect(moveRefusal({ ...facts, passDays: 3 }, "mastered")).toBeNull();
  });
});
