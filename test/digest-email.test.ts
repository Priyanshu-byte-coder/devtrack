import { describe, it, expect } from "vitest";
import { buildDigestHtml, buildDigestText } from "@/lib/digest-email";
import type { DigestEmailData } from "@/lib/digest-email";
import type { DigestMetrics, DigestStreak } from "@/lib/weekly-digest";

const makeStreak = (overrides: Partial<DigestStreak> = {}): DigestStreak => ({
  current: 0,
  longest: 0,
  lastCommitDate: null,
  ...overrides,
});

const makeMetrics = (overrides: Partial<DigestMetrics> = {}): DigestMetrics => ({
  streak: makeStreak(),
  weeklyCommits: 0,
  weeklyActiveDays: 0,
  prsThisWeek: 0,
  topLanguages: [],
  topRepos: [],
  ...overrides,
});

const BASE_DATA: Omit<DigestEmailData, "metrics"> = {
  githubLogin: "testuser",
  unsubscribeUrl: "https://devtrack.example/unsubscribe/tok",
  weekLabel: "Week of 1 January 2025",
};

describe("digest-email", () => {
  describe("buildDigestHtml", () => {
    it("returns a string containing the githubLogin", () => {
      const result = buildDigestHtml({ ...BASE_DATA, metrics: null });
      expect(result).toContain("testuser");
    });

    it("returns a string when metrics is null (graceful empty state)", () => {
      const result = buildDigestHtml({ ...BASE_DATA, metrics: null });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns a string containing the weekLabel", () => {
      const result = buildDigestHtml({ ...BASE_DATA, metrics: null });
      expect(result).toContain("Week of 1 January 2025");
    });

    it("returns a string containing the unsubscribeUrl", () => {
      const result = buildDigestHtml({ ...BASE_DATA, metrics: null });
      expect(result).toContain("https://devtrack.example/unsubscribe/tok");
    });

    it("renders the streak section when metrics.streak.current > 0", () => {
      const result = buildDigestHtml({
        ...BASE_DATA,
        metrics: makeMetrics({ streak: makeStreak({ current: 7, longest: 14 }) }),
      });
      expect(result).toContain("Current Streak");
      expect(result).toContain("7 days");
      expect(result).toContain("14 days");
    });

    it("omits the streak section when metrics is null", () => {
      const result = buildDigestHtml({ ...BASE_DATA, metrics: null });
      expect(result).not.toContain("Current Streak");
    });

    it("renders streak value as 0 when streak.current is 0", () => {
      const result = buildDigestHtml({
        ...BASE_DATA,
        metrics: makeMetrics({ streak: makeStreak({ current: 0 }) }),
      });
      // The HTML always renders the streak section when m is present;
      // the value is 0 rather than the section being hidden.
      expect(result).toContain("Current Streak");
      expect(result).toContain("0 days");
    });

    it("renders language colours for known languages", () => {
      const result = buildDigestHtml({
        ...BASE_DATA,
        metrics: makeMetrics({
          topLanguages: [{ name: "TypeScript", percentage: 80 }],
        }),
      });
      expect(result).toContain("#3178c6");
    });

    it("renders top languages section when languages are provided", () => {
      const result = buildDigestHtml({
        ...BASE_DATA,
        metrics: makeMetrics({
          topLanguages: [
            { name: "Python", percentage: 60 },
            { name: "JavaScript", percentage: 40 },
          ],
        }),
      });
      expect(result).toContain("Python");
      expect(result).toContain("JavaScript");
    });

    it("renders weekly commits in the activity section", () => {
      const result = buildDigestHtml({
        ...BASE_DATA,
        metrics: makeMetrics({ weeklyCommits: 42 }),
      });
      expect(result).toContain("42");
    });
  });

  describe("buildDigestText", () => {
    it("returns a string containing the githubLogin", () => {
      const result = buildDigestText({ ...BASE_DATA, metrics: null });
      expect(result).toContain("testuser");
    });

    it("returns a string when metrics is null", () => {
      const result = buildDigestText({ ...BASE_DATA, metrics: null });
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("contains the streak line when metrics.streak.current > 0", () => {
      const result = buildDigestText({
        ...BASE_DATA,
        metrics: makeMetrics({ streak: makeStreak({ current: 5, longest: 10 }) }),
      });
      expect(result).toContain("streak");
      expect(result).toContain("5");
    });

    it("omits the streak line when streak.current is 0", () => {
      const result = buildDigestText({
        ...BASE_DATA,
        metrics: makeMetrics({ streak: makeStreak({ current: 0 }) }),
      });
      expect(result).not.toContain("streak");
    });

    it("contains weekly commits in activity section when metrics provided", () => {
      const result = buildDigestText({
        ...BASE_DATA,
        metrics: makeMetrics({ weeklyCommits: 12 }),
      });
      expect(result).toContain("12");
      expect(result).toContain("Commits");
    });

    it("contains unsubscribe link", () => {
      const result = buildDigestText({ ...BASE_DATA, metrics: null });
      expect(result).toContain("https://devtrack.example/unsubscribe/tok");
    });
  });
});
