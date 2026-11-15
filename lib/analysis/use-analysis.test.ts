import { describe, it, expect } from "vitest";
import { analysisPhase } from "./use-analysis";

describe("analysisPhase", () => {
  it("is loading until rows arrive", () => {
    expect(analysisPhase(null, 0)).toBe("loading");
  });
  it("is running while there are no rows yet or any row is pending", () => {
    expect(analysisPhase([], 0)).toBe("running");
    expect(analysisPhase([{ status: "done" }, { status: "pending" }], 3)).toBe("running");
  });
  it("settles once every row is done or errored, and stops counting polls", () => {
    expect(analysisPhase([{ status: "done" }, { status: "error" }], 999)).toBe("settled");
  });
  it("stalls when rows are still pending past the server's time budget", () => {
    expect(analysisPhase([{ status: "pending" }], 150)).toBe("stalled");
    expect(analysisPhase([], 150)).toBe("stalled");
  });
});
