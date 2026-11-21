import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots.txt", () => {
  it("blocks SEO-tool crawlers but keeps search engines and AI search", () => {
    const rules = [robots().rules].flat();
    const blocked = rules.find((r) => r.disallow === "/");
    const agents = [blocked?.userAgent].flat();
    expect(agents).toEqual(
      expect.arrayContaining(["AhrefsBot", "SemrushBot", "MJ12bot"])
    );
    for (const kept of [
      "Googlebot",
      "Bingbot",
      "GPTBot",
      "OAI-SearchBot",
      "PerplexityBot",
      "ClaudeBot",
    ])
      expect(agents).not.toContain(kept);
    const everyone = rules.find((r) => r.userAgent === "*");
    expect(everyone?.allow).toBe("/");
  });
});
