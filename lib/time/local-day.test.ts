import { describe, it, expect } from "vitest";
import { endOfLocalDay, localDate } from "./local-day";

describe("local-day", () => {
  it("endOfLocalDay is the last millisecond of the day on the user's clock", () => {
    const ninePm = Date.parse("2026-06-09T21:00:00-05:00");
    const end = endOfLocalDay(ninePm, -5 * 3600);
    expect(end).toBe(Date.parse("2026-06-09T23:59:59.999-05:00"));
    expect(localDate(end, -5 * 3600)).toBe("2026-06-09");
    expect(localDate(end + 1, -5 * 3600)).toBe("2026-06-10");
    // flagged at 9pm (due 9pm tomorrow) is due when practising at 6pm tomorrow
    const flaggedDue = ninePm + 86_400_000;
    const sixPmNextDay = Date.parse("2026-06-10T18:00:00-05:00");
    expect(flaggedDue <= endOfLocalDay(sixPmNextDay, -5 * 3600)).toBe(true);
  });
});
