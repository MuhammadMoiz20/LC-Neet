import TurndownService from "turndown";

export type TestCase = { input: Record<string, unknown>; expected: unknown };

/**
 * Convert LeetCode-flavoured HTML into Markdown.
 *
 * - Uses fenced code blocks and `*` for emphasis.
 * - Renders `<pre>` blocks as fenced code blocks so example I/O survives intact.
 * - Strips non-breaking spaces (U+00A0), which LeetCode emits liberally and
 *   which otherwise leak through as visible-but-not-typeable whitespace.
 */
export function htmlToMarkdown(html: string): string {
  const service = new TurndownService({
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  });

  service.addRule("preAsFencedCode", {
    filter: ["pre"],
    replacement: (_content, node) => {
      const text = (node as HTMLElement).textContent ?? "";
      return `\n\n\`\`\`\n${text.replace(/ /g, " ").trimEnd()}\n\`\`\`\n\n`;
    },
  });

  const md = service.turndown(html);
  return md.replace(/ /g, " ");
}

/**
 * Best-effort JSON coercion: tolerate single-quoted strings and fall back to
 * the raw trimmed string if `JSON.parse` cannot make sense of the value.
 */
function coerceValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    // Try swapping single quotes for double quotes (common in LC examples).
    try {
      return JSON.parse(trimmed.replace(/'/g, '"'));
    } catch {
      return trimmed;
    }
  }
}

/**
 * Extract `{ input, expected }` pairs from rendered example blocks.
 *
 * Walks every fenced code block in `md`, finds an `Input:` line and an
 * `Output:` line within it, and splits the input on top-level
 * `<paramName> = ` boundaries (using the supplied `paramNames`). Code blocks
 * that do not contain both an Input and an Output are skipped.
 */
export function parseExamples(md: string, paramNames: string[]): TestCase[] {
  const cases: TestCase[] = [];
  const fenceRe = /```[a-zA-Z0-9]*\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = fenceRe.exec(md)) !== null) {
    const block = match[1] ?? "";
    const inputMatch = block.match(/Input:\s*([\s\S]*?)(?:\n\s*Output:|$)/);
    const outputMatch = block.match(/Output:\s*([\s\S]*?)(?:\n\s*Explanation:|\n\s*$|$)/);
    if (!inputMatch || !outputMatch) continue;

    const inputText = inputMatch[1].trim();
    const outputText = outputMatch[1].trim();

    const input: Record<string, unknown> = {};
    if (paramNames.length === 0) {
      input["arg"] = coerceValue(inputText);
    } else {
      // Build positions of each `<paramName> = ` within the input text.
      const positions: Array<{ name: string; start: number; valueStart: number }> = [];
      for (const name of paramNames) {
        const re = new RegExp(`(^|[,\\s])${name}\\s*=\\s*`, "g");
        let m: RegExpExecArray | null;
        while ((m = re.exec(inputText)) !== null) {
          positions.push({
            name,
            start: m.index + (m[1] ? m[1].length : 0),
            valueStart: m.index + m[0].length,
          });
        }
      }
      positions.sort((a, b) => a.start - b.start);

      for (let i = 0; i < positions.length; i++) {
        const { name, valueStart } = positions[i];
        const end = i + 1 < positions.length ? positions[i + 1].start : inputText.length;
        let raw = inputText.slice(valueStart, end).trim();
        // Strip trailing comma left over from the next-arg boundary.
        raw = raw.replace(/,\s*$/, "").trim();
        input[name] = coerceValue(raw);
      }
    }

    cases.push({ input, expected: coerceValue(outputText) });
  }

  return cases;
}

/**
 * Rewrite a LeetCode python3 starter snippet into our canonical
 * `class Solution: ... pass` stub.
 *
 * Returns the rewritten starter plus the detected method name.
 * Throws if the snippet does not contain a recognisable `def <name>(self, ...)`.
 */
export function deriveStarter(pythonSnippet: string): { starter: string; methodName: string } {
  const defMatch = pythonSnippet.match(/def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*self[^)]*\)\s*(?:->\s*[^:]+)?\s*:/);
  if (!defMatch) {
    throw new Error("deriveStarter: could not find `def <name>(self, ...)` in snippet");
  }
  const [defLine] = defMatch;
  const methodName = defMatch[1];
  const starter = `class Solution:\n    ${defLine}\n        pass\n`;
  return { starter, methodName };
}
