/**
 * Minimal OpenAI-compatible client for OpenRouter.
 *
 * Replaces @anthropic-ai/claude-agent-sdk. Only what this app needs:
 * streaming text deltas and a bounded tool-call loop. No SDK dependency —
 * plain fetch against /chat/completions.
 */

const BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL ?? "~deepseek/deepseek-v4-flash-latest";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessageParam = {
  role: ChatRole;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/** A tool the model may call. `parameters` is a JSON Schema object. */
export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string> | string;
};

export type ChatOptions = {
  model?: string;
  system: string;
  messages: ChatMessageParam[];
  tools?: ToolDef[];
  /** Max assistant turns, including tool-call round trips. */
  maxTurns?: number;
  signal?: AbortSignal;
};

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    "Content-Type": "application/json",
  };
  // Optional OpenRouter attribution headers.
  if (process.env.OPENROUTER_SITE_URL)
    h["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_APP_NAME)
    h["X-Title"] = process.env.OPENROUTER_APP_NAME;
  return h;
}

function toolSchema(tools: ToolDef[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

async function runToolCalls(
  calls: ToolCall[],
  tools: ToolDef[],
): Promise<ChatMessageParam[]> {
  return Promise.all(
    calls.map(async (call): Promise<ChatMessageParam> => {
      const def = tools.find((t) => t.name === call.function.name);
      let content: string;
      if (!def) {
        content = `Error: unknown tool ${call.function.name}`;
      } else {
        try {
          const args = call.function.arguments
            ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
            : {};
          content = await def.handler(args);
        } catch (err) {
          content = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      return {
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content,
      };
    }),
  );
}

/** Accumulates streamed tool_call deltas, which arrive fragmented by index. */
type PartialToolCall = {
  id: string;
  name: string;
  arguments: string;
};

async function* sseLines(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
}

async function post(body: unknown, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 500)}`);
  }
  return res;
}

/**
 * Stream assistant text. Tool calls are executed transparently and the loop
 * continues; only user-visible text is yielded.
 */
export async function* streamChat(opts: ChatOptions): AsyncGenerator<string> {
  const tools = opts.tools ?? [];
  const maxTurns = opts.maxTurns ?? 4;
  const messages: ChatMessageParam[] = [
    { role: "system", content: opts.system },
    ...opts.messages,
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await post(
      {
        model: opts.model ?? DEFAULT_MODEL,
        messages,
        stream: true,
        ...(tools.length ? { tools: toolSchema(tools) } : {}),
      },
      opts.signal,
    );

    let text = "";
    const partials = new Map<number, PartialToolCall>();

    for await (const data of sseLines(res)) {
      if (data === "[DONE]") break;
      if (!data) continue;
      let chunk: {
        choices?: Array<{
          delta?: {
            content?: string | null;
            tool_calls?: Array<{
              index: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
        error?: { message?: string };
      };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue; // OpenRouter sends ": OPENROUTER PROCESSING" keepalives
      }
      if (chunk.error) throw new Error(chunk.error.message ?? "OpenRouter error");
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (typeof delta.content === "string" && delta.content) {
        text += delta.content;
        yield delta.content;
      }
      for (const tc of delta.tool_calls ?? []) {
        const prev = partials.get(tc.index) ?? { id: "", name: "", arguments: "" };
        partials.set(tc.index, {
          id: tc.id ?? prev.id,
          name: tc.function?.name ?? prev.name,
          arguments: prev.arguments + (tc.function?.arguments ?? ""),
        });
      }
    }

    if (partials.size === 0) return;

    const calls: ToolCall[] = [...partials.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => ({
        id: p.id,
        type: "function" as const,
        function: { name: p.name, arguments: p.arguments },
      }));
    messages.push({ role: "assistant", content: text || null, tool_calls: calls });
    messages.push(...(await runToolCalls(calls, tools)));
  }
}

/** Non-streaming single completion; returns the assistant's text. */
export async function completeChat(
  opts: Omit<ChatOptions, "tools" | "maxTurns">,
): Promise<string> {
  const res = await post(
    {
      model: opts.model ?? DEFAULT_MODEL,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
      stream: false,
    },
    opts.signal,
  );
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}
