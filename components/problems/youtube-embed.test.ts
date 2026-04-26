import { describe, it, expect } from "vitest";
import { extractYouTubeId } from "./youtube-embed";

describe("extractYouTubeId", () => {
  it("extracts the v= param from a standard watch URL", () => {
    expect(
      extractYouTubeId("https://www.youtube.com/watch?v=KLlXCFG5TnA"),
    ).toBe("KLlXCFG5TnA");
  });

  it("returns null for null/undefined/empty", () => {
    expect(extractYouTubeId(null)).toBeNull();
    expect(extractYouTubeId(undefined)).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
  });

  it("returns null for a URL with no v= param", () => {
    expect(extractYouTubeId("https://www.youtube.com/")).toBeNull();
  });

  it("returns null for an unparseable URL", () => {
    expect(extractYouTubeId("not a url")).toBeNull();
  });
});
