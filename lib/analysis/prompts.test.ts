import { describe, it, expect } from "vitest";
import { analysisPrompt } from "./prompts";
import type { AnalysisKind } from "./repo";

const ALL_KINDS: AnalysisKind[] = [
  "quality",
  "complexity",
  "comparison",
  "pattern",
  "mistake",
];

describe("analysisPrompt", () => {
  it("quality mentions PEP 8 and naming", () => {
    const p = analysisPrompt("quality");
    expect(p).toMatch(/PEP 8/);
    expect(p.toLowerCase()).toContain("naming");
  });

  it("complexity mentions Big-O and asks for a reasoning trace", () => {
    const p = analysisPrompt("complexity");
    expect(p).toMatch(/Big-O/);
    expect(p.toLowerCase()).toContain("reasoning");
  });

  it("comparison asks to compare against the optimal approach", () => {
    const p = analysisPrompt("comparison");
    expect(p.toLowerCase()).toContain("optimal");
  });

  it("pattern instructs the model to start with literal `Pattern:` prefix", () => {
    const p = analysisPrompt("pattern");
    expect(p).toContain("Pattern:");
    // Must explicitly tell the model to start the response with that prefix.
    expect(p.toLowerCase()).toMatch(/start|begin|first line/);
  });

  it("mistake instructs the model to start with literal `Category:` prefix", () => {
    const p = analysisPrompt("mistake");
    expect(p).toContain("Category:");
    expect(p.toLowerCase()).toMatch(/start|begin|first line/);
  });

  it("every kind embeds the NO_SOLUTION_RULE", () => {
    for (const kind of ALL_KINDS) {
      const p = analysisPrompt(kind);
      expect(p).toContain("NEVER");
      expect(p).toContain("full runnable solution");
    }
  });
});
