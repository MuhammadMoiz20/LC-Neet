import { vi, describe, test, expect, beforeEach } from "vitest";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

import { query } from "@anthropic-ai/claude-agent-sdk";
import { runOne } from "./run-one";

function asyncIterFromMessages(messages: unknown[]) {
  return (async function* () {
    for (const m of messages) yield m;
  })();
}

function assistantText(text: string) {
  return {
    type: "assistant",
    message: { content: [{ type: "text", text }] },
  };
}

const baseInput = {
  code: "x = 1\n",
  problemTitle: "Two Sum",
  problemTopic: "Array",
  problemDifficulty: "Easy",
  problemDescription: "Find indices of two nums summing to target.",
};

beforeEach(() => {
  vi.mocked(query).mockReset();
});

describe("runOne", () => {
  test("invokes query with quality system prompt containing 'PEP 8'", async () => {
    vi.mocked(query).mockReturnValue(
      asyncIterFromMessages([assistantText("ok")]) as never,
    );
    await runOne({ kind: "quality", ...baseInput });
    const firstCallArg = vi.mocked(query).mock.calls[0][0] as {
      options: { systemPrompt: string };
    };
    expect(firstCallArg.options.systemPrompt).toContain("PEP 8");
  });

  test("returns done with content_md from a single assistant text block", async () => {
    vi.mocked(query).mockReturnValue(
      asyncIterFromMessages([assistantText("hello world")]) as never,
    );
    const result = await runOne({ kind: "quality", ...baseInput });
    expect(result).toEqual({
      kind: "quality",
      content_md: "hello world",
      status: "done",
    });
  });

  test("returns error status when SDK throws", async () => {
    vi.mocked(query).mockImplementation(() => {
      throw new Error("boom");
    });
    const result = await runOne({ kind: "complexity", ...baseInput });
    expect(result.kind).toBe("complexity");
    expect(result.status).toBe("error");
  });

  test("blocks full-solution leaks", async () => {
    const leak = "def foo():\n    a=1\n    b=2\n    c=3\n    d=4\n    return d\n";
    vi.mocked(query).mockReturnValue(
      asyncIterFromMessages([assistantText(leak)]) as never,
    );
    const result = await runOne({ kind: "quality", ...baseInput });
    expect(result).toEqual({
      kind: "quality",
      content_md: "[blocked: full-solution leak]",
      status: "error",
    });
  });

  test("trims trailing whitespace from content_md", async () => {
    vi.mocked(query).mockReturnValue(
      asyncIterFromMessages([assistantText("clean text   \n\n  ")]) as never,
    );
    const result = await runOne({ kind: "pattern", ...baseInput });
    expect(result.content_md).toBe("clean text");
  });
});
