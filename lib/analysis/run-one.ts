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

// OpenRouter spreads calls over many providers, and now and then one of them
// accepts a call and never answers. A call that is silent for this long is
// abandoned and sent again (which usually lands on a different provider).
// Healthy calls take 2-12s. Without a limit, one hung call held the whole run
// until the platform killed it at 300s, leaving its rows pending forever.
const TRY_TIMEOUT_MS = 30_000;
const TRIES = 3;

async function completeWithRetry(kind: AnalysisKind, system: string, userPrompt: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await completeChat({
        system,
        messages: [{ role: "user", content: userPrompt }],
        signal: AbortSignal.timeout(TRY_TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      if (timedOut) console.log(JSON.stringify({ evt: "llm_timeout", kind, attempt }));
      if (!timedOut || attempt === TRIES) throw err;
    }
  }
}

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
    const buffer = await completeWithRetry(input.kind, analysisPrompt(input.kind), userPrompt);
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
        ? `the model didn't answer in ${TRIES} tries of ${TRY_TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : "unknown error";
    return { kind: input.kind, content_md: `[error: ${msg}]`, status: "error" };
  }
}
