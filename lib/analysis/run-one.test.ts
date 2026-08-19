import { vi, describe, test, expect, beforeEach } from "vitest";

vi.mock("@/lib/llm/openrouter", () => ({
  completeChat: vi.fn(),
}));

import { completeChat } from "@/lib/llm/openrouter";
import { runOne } from "./run-one";


const baseInput = {
  code: "x = 1\n",
  problemTitle: "Two Sum",
  problemTopic: "Array",
  problemDifficulty: "Easy",
  problemDescription: "Find indices of two nums summing to target.",
};

beforeEach(() => {
  vi.mocked(completeChat).mockReset();
});

describe("runOne", () => {
  test("invokes query with quality system prompt containing 'PEP 8'", async () => {
    vi.mocked(completeChat).mockResolvedValue("ok");
    await runOne({ kind: "quality", ...baseInput });
    const firstCallArg = vi.mocked(completeChat).mock.calls[0][0];
    expect(firstCallArg.system).toContain("PEP 8");
  });

  test("returns done with content_md from a single assistant text block", async () => {
    vi.mocked(completeChat).mockResolvedValue("hello world");
    const result = await runOne({ kind: "quality", ...baseInput });
    expect(result).toEqual({
      kind: "quality",
      content_md: "hello world",
      status: "done",
    });
  });

  test("returns error status when the API throws", async () => {
    vi.mocked(completeChat).mockRejectedValue(new Error("boom"));
    const result = await runOne({ kind: "complexity", ...baseInput });
    expect(result.kind).toBe("complexity");
    expect(result.status).toBe("error");
  });

  test("blocks full-solution leaks", async () => {
    const leak = "def foo():\n    a=1\n    b=2\n    c=3\n    d=4\n    return d\n";
    vi.mocked(completeChat).mockResolvedValue(leak);
    const result = await runOne({ kind: "quality", ...baseInput });
    expect(result).toEqual({
      kind: "quality",
      content_md: "[blocked: full-solution leak]",
      status: "error",
    });
  });

  test("trims trailing whitespace from content_md", async () => {
    vi.mocked(completeChat).mockResolvedValue("clean text   \n\n  ");
    const result = await runOne({ kind: "pattern", ...baseInput });
    expect(result.content_md).toBe("clean text");
  });
});
