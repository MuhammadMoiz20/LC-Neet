import { describe, it, expect, vi, beforeEach } from "vitest";

const streamChatMock = vi.fn();
vi.mock("../llm/openrouter", () => ({
  streamChat: (...args: unknown[]) => streamChatMock(...args),
}));

import { streamCoach } from "./stream";

beforeEach(() => {
  streamChatMock.mockReset();
});

function chunks(...texts: string[]) {
  return async function* () {
    for (const t of texts) yield t;
  };
}

describe("streamCoach", () => {
  it("yields deltas then done; passes system prompt for mode and tools", async () => {
    streamChatMock.mockImplementation(chunks("Hello ", "world"));
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
    const opts = streamChatMock.mock.calls[0][0];
    expect(opts.system).toMatch(/Socratic coding coach/);
    expect(opts.tools.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(["get_problem_meta", "get_user_history"]),
    );
  });

  it("emits 'blocked' and stops when filter trips", async () => {
    streamChatMock.mockImplementation(
      chunks(
        "```python\nclass Solution:\n",
        "    def twoSum(self, nums, target):\n",
        "        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n",
        "more text after",
      ),
    );
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
    expect(
      events.find((e) => e.type === "delta" && e.text?.includes("more text after")),
    ).toBeUndefined();
  });
});
