import { describe, expect, it } from "vitest";
import { buildOutputLines } from "./run-panel";
import type { RunResult } from "@/lib/pyodide/worker-protocol";

describe("buildOutputLines stdout", () => {
  it("emits indented stdout lines under a passing test", () => {
    const result: RunResult = {
      compile_error: null,
      results: [
        {
          passed: true,
          actual: 3,
          expected: 3,
          stdout: "debug: i=0\ndebug: i=1\n",
          elapsed_ms: 4,
          error: null,
        },
      ],
    };
    const lines = buildOutputLines(result, false);
    const texts = lines.map((l) => l.text);
    expect(texts).toContain("   debug: i=0");
    expect(texts).toContain("   debug: i=1");
  });

  it("emits stdout under a failing test, before expected/actual", () => {
    const result: RunResult = {
      compile_error: null,
      results: [
        {
          passed: false,
          actual: 2,
          expected: 3,
          stdout: "oops\n",
          elapsed_ms: 4,
          error: null,
        },
      ],
    };
    const texts = buildOutputLines(result, false).map((l) => l.text);
    const stdoutIdx = texts.indexOf("   oops");
    const expectedIdx = texts.findIndex((t) => t.startsWith("   expected:"));
    expect(stdoutIdx).toBeGreaterThanOrEqual(0);
    expect(stdoutIdx).toBeLessThan(expectedIdx);
  });

  it("emits nothing extra when stdout is empty", () => {
    const result: RunResult = {
      compile_error: null,
      results: [
        { passed: true, actual: 1, expected: 1, stdout: "", elapsed_ms: 1, error: null },
      ],
    };
    const texts = buildOutputLines(result, false).map((l) => l.text);
    expect(texts.some((t) => t.startsWith("   "))).toBe(false);
  });
});
