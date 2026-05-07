import { query } from "@anthropic-ai/claude-agent-sdk";
import { looksLikeFullSolution } from "@/lib/agent/filter";
import { analysisPrompt } from "./prompts";
import type { AnalysisKind, AnalysisStatus } from "./repo";

export type RunOneInput = {
  kind: AnalysisKind;
  code: string;
  problemTitle: string;
  problemTopic: string;
  problemDifficulty: string;
  problemDescription: string;
};

export type RunOneResult = {
  kind: AnalysisKind;
  content_md: string;
  status: AnalysisStatus;
};

export async function runOne(input: RunOneInput): Promise<RunOneResult> {
  const userPrompt = `Problem: ${input.problemTitle} (${input.problemDifficulty}, ${input.problemTopic})

Description:
${input.problemDescription}

Submitted code:
\`\`\`python
${input.code}
\`\`\`

Provide the analysis described in your system prompt.`;

  try {
    let buffer = "";
    for await (const m of query({
      prompt: userPrompt,
      options: {
        model: "claude-sonnet-4-6",
        systemPrompt: analysisPrompt(input.kind),
        maxTurns: 1,
      },
    })) {
      if (m.type === "assistant") {
        for (const block of m.message.content) {
          if (block.type === "text") buffer += block.text;
        }
      }
    }
    if (looksLikeFullSolution(buffer)) {
      return {
        kind: input.kind,
        content_md: "[blocked: full-solution leak]",
        status: "error",
      };
    }
    return { kind: input.kind, content_md: buffer.trim(), status: "done" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return { kind: input.kind, content_md: `[error: ${msg}]`, status: "error" };
  }
}
