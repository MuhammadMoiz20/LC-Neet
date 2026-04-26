import { describe, test, expect } from "vitest";
import { systemPrompt } from "./prompts";

describe("systemPrompt", () => {
  test("style mode mentions PEP 8", () => {
    expect(systemPrompt("style")).toContain("PEP 8");
  });
  test("socratic and hints still work", () => {
    expect(systemPrompt("socratic").length).toBeGreaterThan(0);
    expect(systemPrompt("hints").length).toBeGreaterThan(0);
  });
});
