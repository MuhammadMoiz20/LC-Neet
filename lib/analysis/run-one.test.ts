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

  const timeout = () =>
    Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

  test("a call that hangs is sent again, and the retry's answer is used", async () => {
    vi.mocked(completeChat).mockRejectedValueOnce(timeout()).mockResolvedValueOnce("Grade: 8");
    const result = await runOne({ kind: "grade", ...baseInput });
    expect(vi.mocked(completeChat)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(completeChat).mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ kind: "grade", content_md: "Grade: 8", status: "done" });
  });

  test("three hung tries become a failed section; other errors are not retried", async () => {
    vi.mocked(completeChat).mockRejectedValue(timeout());
    const hung = await runOne({ kind: "grade", ...baseInput });
    expect(vi.mocked(completeChat)).toHaveBeenCalledTimes(3);
    expect(hung.status).toBe("error");
    expect(hung.content_md).toContain("didn't answer in 3 tries of 30s");

    vi.mocked(completeChat).mockReset();
    vi.mocked(completeChat).mockRejectedValue(new Error("OpenRouter 401: bad key"));
    const refused = await runOne({ kind: "grade", ...baseInput });
    expect(vi.mocked(completeChat)).toHaveBeenCalledTimes(1);
    expect(refused.content_md).toContain("401");
  });

  test("analysis calls turn the model's thinking off", async () => {
    vi.mocked(completeChat).mockResolvedValue("Grade: 8");
    await runOne({ kind: "grade", ...baseInput });
    expect(vi.mocked(completeChat).mock.calls[0][0].reasoningEffort).toBe("none");
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

test("marks an empty model response as error rather than done", async () => {
  vi.mocked(completeChat).mockResolvedValue("   \n  ");
  const result = await runOne({ kind: "mistake", ...baseInput });
  expect(result.status).toBe("error");
  expect(result.content_md).toContain("empty response");
});
