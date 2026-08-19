import type { ChatMessage, ChatMode } from "../chat/repo";
import { getDb } from "../db";
import { getProblemMeta, getUserHistory } from "./tools";
import { systemPrompt } from "./prompts";
import { looksLikeFullSolution } from "./filter";
import { streamChat, type ToolDef } from "../llm/openrouter";

export type CoachEvent =
  | { type: "delta"; text: string }
  | { type: "blocked"; text: string }
  | { type: "done" };

export type StreamCoachInput = {
  mode: ChatMode;
  problemId: number;
  userId: number;
  code: string;
  lastRunOutput: string | null;
  history: ChatMessage[];
  userMessage: string;
};

const BLOCKED_MESSAGE =
  "I can't share a full solution. Want a hint about the data structure or invariant instead?";

function buildContextHeader(input: StreamCoachInput): string {
  const parts = [
    `Problem id: ${input.problemId}. Use the get_problem_meta tool for title/topic/description.`,
    `Current code:\n\`\`\`python\n${input.code || "(empty)"}\n\`\`\``,
  ];
  if (input.lastRunOutput) {
    parts.push(`Last test run output:\n\`\`\`\n${input.lastRunOutput}\n\`\`\``);
  }
  if (input.history.length > 0) {
    const recent = input.history
      .slice(-8)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");
    parts.push(`Recent conversation:\n${recent}`);
  }
  return parts.join("\n\n");
}

function coachTools(input: StreamCoachInput): ToolDef[] {
  return [
    {
      name: "get_problem_meta",
      description:
        "Return title, difficulty, topic, and a short description excerpt for the current problem.",
      parameters: {
        type: "object",
        properties: { problemId: { type: "integer" } },
        required: ["problemId"],
      },
      handler: (args) =>
        JSON.stringify(getProblemMeta(getDb(), Number(args.problemId))),
    },
    {
      name: "get_user_history",
      description:
        "Return up to N recent attempts by the current user filtered to a topic.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["topic"],
      },
      handler: (args) => {
        const limit = Math.min(50, Math.max(1, Number(args.limit) || 10));
        return JSON.stringify(
          getUserHistory(getDb(), input.userId, String(args.topic), limit),
        );
      },
    },
  ];
}

export async function* streamCoach(
  input: StreamCoachInput,
): AsyncGenerator<CoachEvent> {
  const fullPrompt = `${buildContextHeader(input)}\n\nUser: ${input.userMessage}`;

  let buffer = "";
  for await (const text of streamChat({
    system: systemPrompt(input.mode),
    messages: [{ role: "user", content: fullPrompt }],
    tools: coachTools(input),
    maxTurns: 4,
  })) {
    buffer += text;
    if (looksLikeFullSolution(buffer)) {
      yield { type: "blocked", text: BLOCKED_MESSAGE };
      return;
    }
    yield { type: "delta", text };
  }
  yield { type: "done" };
}
