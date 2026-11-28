import { describe, it, expect } from "vitest";
import { SPONSOR_LINKS, PLACEMENT_SPONSORS } from "@/lib/sponsor-links";

describe("SPONSOR_LINKS", () => {
  it("provides the GitHub Sponsors link", () => {
    expect(SPONSOR_LINKS.github).toBe(
      "https://github.com/sponsors/Priyanshu-byte-coder"
    );
  });

  it("provides the Buy Me a Chai link", () => {
    expect(SPONSOR_LINKS.chai).toBe("https://www.buymeachai.in/devtrack");
  });
});

describe("PLACEMENT_SPONSORS", () => {
  it("starts empty when no companies have sponsored a placement", () => {
    expect(PLACEMENT_SPONSORS).toEqual([]);
  });
});
