import { describe, expect, it } from "vitest";
import { findGuide, GUIDES } from "@/content/guides";

describe("Guide: Show your GitHub stats on your portfolio site", () => {
  it("exists in the guides registry with valid slug and metadata", () => {
    const guide = findGuide("github-badges-on-your-website");
    expect(guide).toBeDefined();
    expect(guide?.slug).toBe("github-badges-on-your-website");
    expect(guide?.title).toBe("Show your GitHub stats on your portfolio site");
    expect(guide?.description.length).toBeLessThanOrEqual(160);
    expect(guide?.published).toBe("2026-11-25");
    expect(guide?.updated).toBe("2026-11-25");
  });

  it("contains at least 2 FAQ entries with non-empty questions and answers", () => {
    const guide = findGuide("github-badges-on-your-website");
    expect(guide?.faq.length).toBeGreaterThanOrEqual(2);
    for (const item of guide!.faq) {
      expect(item.q.trim().length).toBeGreaterThan(0);
      expect(item.a.trim().length).toBeGreaterThan(0);
    }
  });

  it("renders a valid ReactNode body", () => {
    const guide = findGuide("github-badges-on-your-website");
    expect(typeof guide?.body).toBe("function");
    const node = guide?.body();
    expect(node).toBeDefined();
  });
});
