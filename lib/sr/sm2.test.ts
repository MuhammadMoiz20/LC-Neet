import { describe, test, expect } from "vitest";
import { nextReview, gradeFromAttempt } from "./sm2";

describe("nextReview", () => {
  test("grade 5 keeps ease and grows interval", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 1, grade: 5, now: 0 }))
      .toMatchObject({ ease: 2.6, intervalDays: 6 });
  });
  test("grade 4 keeps ease equal", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 1, grade: 4, now: 0 }))
      .toMatchObject({ ease: 2.5, intervalDays: 6 });
  });
  test("grade 2 resets interval and lowers ease", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 6, grade: 2, now: 0 }))
      .toMatchObject({ ease: 2.18, intervalDays: 1 });
  });
  test("grade 0 floors ease at 1.3", () => {
    expect(nextReview({ ease: 1.4, intervalDays: 1, grade: 0, now: 0 }))
      .toMatchObject({ ease: 1.3, intervalDays: 1 });
  });
  test("dueAt = now + intervalDays * 86_400_000", () => {
    const { intervalDays, dueAt } = nextReview({ ease: 2.5, intervalDays: 6, grade: 5, now: 1_000 });
    expect(dueAt - 1_000).toBe(intervalDays * 86_400_000);
  });
  test("intervalDays === 1 path bumps to 6 on success", () => {
    expect(nextReview({ ease: 2.5, intervalDays: 1, grade: 5, now: 0 }).intervalDays).toBe(6);
  });
  test("intervalDays > 1 multiplies by ease", () => {
    const r = nextReview({ ease: 2.5, intervalDays: 6, grade: 5, now: 0 });
    expect(r.intervalDays).toBe(Math.round(6 * r.ease)); // 6 * 2.6 = 16
  });
});

describe("gradeFromAttempt", () => {
  test("error -> 0", () => {
    expect(gradeFromAttempt({ status: "error", attemptCount: 1, usedHints: false })).toBe(0);
  });
  test("failed -> 2", () => {
    expect(gradeFromAttempt({ status: "failed", attemptCount: 2, usedHints: false })).toBe(2);
  });
  test("passed first try no hints -> 5", () => {
    expect(gradeFromAttempt({ status: "passed", attemptCount: 1, usedHints: false })).toBe(5);
  });
  test("passed but used hints -> 4", () => {
    expect(gradeFromAttempt({ status: "passed", attemptCount: 1, usedHints: true })).toBe(4);
  });
  test("passed but multi-attempt -> 4", () => {
    expect(gradeFromAttempt({ status: "passed", attemptCount: 3, usedHints: false })).toBe(4);
  });
});
