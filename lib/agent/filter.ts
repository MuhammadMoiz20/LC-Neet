const TRIVIAL_LINE = /^\s*(#.*|""".*?"""|'''.*?'''|pass|\.\.\.|)\s*$/;

/**
 * Heuristic: returns true if `text` appears to contain a full runnable Python
 * solution. We look for either a `class Solution:` block or a top-level `def`
 * whose body has more than 3 non-trivial lines. Trivial = blank, comment,
 * docstring, `pass`, or `...`.
 *
 * False positives are acceptable here — the cost of blocking a legitimate
 * 4-line snippet is much lower than the cost of leaking a real solution.
 */
export function looksLikeFullSolution(text: string): boolean {
  return (
    hasSubstantiveBody(text, /^class\s+Solution\b.*:\s*$/m) ||
    hasSubstantiveBody(text, /^def\s+\w+\s*\(.*\)\s*:\s*$/m)
  );
}

function hasSubstantiveBody(text: string, headerRe: RegExp): boolean {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!headerRe.test(lines[i])) continue;
    let bodyIndent = -1;
    let nonTrivial = 0;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") continue;
      const indent = line.length - line.trimStart().length;
      if (bodyIndent === -1) bodyIndent = indent;
      if (indent < bodyIndent) break;
      if (TRIVIAL_LINE.test(line)) continue;
      nonTrivial++;
      if (nonTrivial > 3) return true;
    }
  }
  return false;
}
