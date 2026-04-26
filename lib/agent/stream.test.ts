import { describe, it, expect, vi, beforeEach } from "vitest";

const queryMock = vi.fn();
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: (...args: unknown[]) => queryMock(...args),
  tool: (name: string, desc: string, schema: unknown, handler: unknown) => ({
    name,
    desc,
    schema,
    handler,
  }),
  createSdkMcpServer: (cfg: unknown) => ({ __mcp: true, cfg }),
}));

import { streamCoach } from "./stream";

function deltaEvent(text: string) {
  return {
    type: "stream_event" as const,
    event: { type: "content_block_delta", delta: { type: "text_delta", text } },
  };
}
function resultEvent() {
  return { type: "result" as const, subtype: "success" as const, result: "" };
}

beforeEach(() => {
  queryMock.mockReset();
});

describe("streamCoach", () => {
  it("yields deltas then done; passes systemPrompt for mode", async () => {
    queryMock.mockImplementation(async function* () {
      yield deltaEvent("Hello ");
      yield deltaEvent("world");
      yield resultEvent();
    });
    const events = [];
    for await (const e of streamCoach({
      mode: "socratic",
      problemId: 1,
      userId: 1,
      code: "x",
      lastRunOutput: null,
      history: [],
      userMessage: "?",
    })) {
      events.push(e);
    }
    expect(events.map((e) => e.type)).toEqual(["delta", "delta", "done"]);
    expect(events[0]).toEqual({ type: "delta", text: "Hello " });
    const opts = queryMock.mock.calls[0][0].options;
    expect(opts.systemPrompt).toMatch(/Socratic coding coach/);
    expect(opts.mcpServers).toBeDefined();
    expect(opts.allowedTools).toEqual(
      expect.arrayContaining([
        "mcp__lcneet__get_problem_meta",
        "mcp__lcneet__get_user_history",
      ]),
    );
  });

  it("emits 'blocked' and stops when filter trips", async () => {
    queryMock.mockImplementation(async function* () {
      yield deltaEvent("```python\nclass Solution:\n");
      yield deltaEvent("    def twoSum(self, nums, target):\n");
      yield deltaEvent("        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n");
      yield deltaEvent("more text after");
      yield resultEvent();
    });
    const events = [];
    for await (const e of streamCoach({
      mode: "hints",
      problemId: 1,
      userId: 1,
      code: "",
      lastRunOutput: null,
      history: [],
      userMessage: "give me the solution",
    })) {
      events.push(e);
    }
    const types = events.map((e) => e.type);
    expect(types).toContain("blocked");
    expect(types[types.length - 1]).toBe("blocked");
    expect(events.find((e) => e.type === "delta" && e.text?.includes("more text after"))).toBeUndefined();
  });
});
