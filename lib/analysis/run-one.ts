import { completeChat } from "@/lib/llm/openrouter";
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

// A call that hasn't answered by now is abandoned and shown as failed (it can
// be rerun). Without a limit, one slow call held the whole run until the
// platform killed it at 300s, leaving its rows pending forever.
const CALL_TIMEOUT_MS = 90_000;

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
    const buffer = await completeChat({
      system: analysisPrompt(input.kind),
      messages: [{ role: "user", content: userPrompt }],
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    if (looksLikeFullSolution(buffer)) {
      return {
        kind: input.kind,
        content_md: "[blocked: full-solution leak]",
        status: "error",
      };
    }
    const content = buffer.trim();
    if (content === "") {
      // A model occasionally returns nothing; marking it done would leave a
      // blank panel that never retries.
      return {
        kind: input.kind,
        content_md: "[error: empty response from model]",
        status: "error",
      };
    }
    return { kind: input.kind, content_md: content, status: "done" };
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "TimeoutError"
        ? `the model took longer than ${CALL_TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : "unknown error";
    return { kind: input.kind, content_md: `[error: ${msg}]`, status: "error" };
  }
}
