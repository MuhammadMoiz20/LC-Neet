import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ChatMessage, ChatMode } from "../chat/repo";
import { getDb } from "../db";
import { getProblemMeta, getUserHistory } from "./tools";
import { systemPrompt } from "./prompts";
import { looksLikeFullSolution } from "./filter";

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

export async function* streamCoach(
  input: StreamCoachInput,
): AsyncGenerator<CoachEvent> {
  const mcpServer = createSdkMcpServer({
    name: "lcneet",
    version: "1.0.0",
    tools: [
      tool(
        "get_problem_meta",
        "Return title, difficulty, topic, and a short description excerpt for the current problem.",
        { problemId: z.number().int() },
        async (args: { problemId: number }) => {
          const meta = getProblemMeta(getDb(), args.problemId);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(meta) },
            ],
          };
        },
      ),
      tool(
        "get_user_history",
        "Return up to N recent attempts by the current user filtered to a topic.",
        {
          topic: z.string(),
          limit: z.number().int().min(1).max(50).default(10),
        },
        async (args: { topic: string; limit: number }) => {
          const hist = getUserHistory(
            getDb(),
            input.userId,
            args.topic,
            args.limit,
          );
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(hist) },
            ],
          };
        },
      ),
    ],
  });

  const fullPrompt = `${buildContextHeader(input)}\n\nUser: ${input.userMessage}`;

  let buffer = "";
  let blocked = false;
  const it = query({
    prompt: fullPrompt,
    options: {
      systemPrompt: systemPrompt(input.mode),
      mcpServers: { lcneet: mcpServer },
      allowedTools: [
        "mcp__lcneet__get_problem_meta",
        "mcp__lcneet__get_user_history",
      ],
      includePartialMessages: true,
      maxTurns: 4,
    },
  });

  for await (const msg of it) {
    if (blocked) continue;
    if (msg.type === "stream_event") {
      const ev = msg.event as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (
        ev?.type === "content_block_delta" &&
        ev.delta?.type === "text_delta" &&
        typeof ev.delta.text === "string"
      ) {
        const text = ev.delta.text;
        buffer += text;
        if (looksLikeFullSolution(buffer)) {
          blocked = true;
          yield { type: "blocked", text: BLOCKED_MESSAGE };
          continue;
        }
        yield { type: "delta", text };
      }
    } else if (msg.type === "result") {
      break;
    }
  }
  if (!blocked) yield { type: "done" };
}
