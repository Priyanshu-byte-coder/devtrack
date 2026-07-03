import { describe, it, expect } from "vitest";
import { generateWeeklySummary } from "../src/lib/anthropic";

describe("anthropic", () => {
  describe("generateWeeklySummary", () => {
    it("returns null when ANTHROPIC_API_KEY is not set", async () => {
      // The function checks ANTHROPIC_API_KEY and returns null if empty
      const result = await generateWeeklySummary({
        commits: { current: 10, previous: 5, delta: 5, trend: "up" },
        prs: {
          thisWeek: { opened: 3, merged: 2 },
          lastWeek: { opened: 1, merged: 1 },
        },
        streak: 7,
        topRepo: "my-project",
        activeDays: { thisWeek: 5, lastWeek: 3 },
      });
      // Without ANTHROPIC_API_KEY set, returns null
      expect(result).toBeNull();
    });
  });
});
