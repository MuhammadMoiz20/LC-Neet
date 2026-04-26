import { query } from "@anthropic-ai/claude-agent-sdk";

const messages = [];
for await (const m of query({
  prompt: "Say only the word 'ready'.",
  options: { maxTurns: 1 },
})) {
  messages.push(m);
  if (m.type === "result") {
    console.log("subtype:", m.subtype, "result:", m.subtype === "success" ? m.result : m.errors);
  }
}
if (!messages.some((m) => m.type === "result")) {
  console.error("NO RESULT MESSAGE — auth or SDK install likely broken");
  process.exit(1);
}
