import { describe, it, expect } from "vitest";
import {
  buildDeveloperPersonaResponse,
  mergeCommitCounts,
  mergeSignals,
  DeveloperSignals,
  calculateStreaks,
  formatDurationHours,
  choosePersonaCandidate,
  buildSmartInsightCandidates,
  PersonaKey,
} from "../src/lib/developer-persona";

describe("Developer Persona Utilities", () => {
  const emptySignals: DeveloperSignals = {
    commitCountsByDate: {},
    timeBlocks: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    prsOpened: 0,
    prsMerged: 0,
    prMergeTotalHours: 0,
    prMergeSampleSize: 0,
    additions: 0,
    deletions: 0,
  };

  describe("mergeCommitCounts", () => {
    it("should merge two empty commit count records", () => {
      expect(mergeCommitCounts({}, {})).toEqual({});
    });

    it("should merge commit counts from distinct days", () => {
      const a = { "2026-05-01": 5 };
      const b = { "2026-05-02": 3 };
      expect(mergeCommitCounts(a, b)).toEqual({
        "2026-05-01": 5,
        "2026-05-02": 3,
      });
    });

    it("should sum commit counts for overlapping days", () => {
      const a = { "2026-05-01": 5, "2026-05-02": 2 };
      const b = { "2026-05-02": 3, "2026-05-03": 1 };
      expect(mergeCommitCounts(a, b)).toEqual({
        "2026-05-01": 5,
        "2026-05-02": 5,
        "2026-05-03": 1,
      });
    });
  });

  describe("mergeSignals", () => {
    it("should merge two empty developer signals", () => {
      expect(mergeSignals(emptySignals, emptySignals)).toEqual(emptySignals);
    });

    it("should merge and sum values for two signals correctly", () => {
      const s1: DeveloperSignals = {
        commitCountsByDate: { "2026-05-01": 2 },
        timeBlocks: { morning: 1, afternoon: 2, evening: 3, night: 4 },
        prsOpened: 3,
        prsMerged: 2,
        prMergeTotalHours: 12,
        prMergeSampleSize: 2,
        additions: 150,
        deletions: 50,
      };

      const s2: DeveloperSignals = {
        commitCountsByDate: { "2026-05-01": 3, "2026-05-02": 1 },
        timeBlocks: { morning: 2, afternoon: 1, evening: 0, night: 1 },
        prsOpened: 1,
        prsMerged: 1,
        prMergeTotalHours: 3,
        prMergeSampleSize: 1,
        additions: 200,
        deletions: 300,
      };

      expect(mergeSignals(s1, s2)).toEqual({
        commitCountsByDate: { "2026-05-01": 5, "2026-05-02": 1 },
        timeBlocks: { morning: 3, afternoon: 3, evening: 3, night: 5 },
        prsOpened: 4,
        prsMerged: 3,
        prMergeTotalHours: 15,
        prMergeSampleSize: 3,
        additions: 350,
        deletions: 350,
      });
    });
  });

  describe("buildDeveloperPersonaResponse", () => {
    it("should fall back to balanced_builder for empty or neutral signals", () => {
      const result = buildDeveloperPersonaResponse(emptySignals);
      expect(result.persona.key).toBe("balanced_builder");
      expect(result.insights.length).toBe(0);
    });

    it("should categorize as night_owl when nighttime commits are highly dominant", () => {
      const signals: DeveloperSignals = {
        ...emptySignals,
        commitCountsByDate: {
          "2026-05-01": 2,
          "2026-05-02": 2,
          "2026-05-03": 2,
          "2026-05-04": 2,
          "2026-05-05": 2,
        },
        timeBlocks: { morning: 0, afternoon: 0, evening: 1, night: 9 },
      };

      const result = buildDeveloperPersonaResponse(signals);
      expect(result.persona.key).toBe("night_owl");
      expect(result.insights.some(i => i.title === "Late-Night Focus")).toBe(true);
    });

    it("should categorize as early_bird when morning commits are highly dominant", () => {
      const signals: DeveloperSignals = {
        ...emptySignals,
        commitCountsByDate: {
          "2026-05-01": 2,
          "2026-05-02": 2,
          "2026-05-03": 2,
          "2026-05-04": 2,
          "2026-05-05": 2,
        },
        timeBlocks: { morning: 9, afternoon: 1, evening: 0, night: 0 },
      };

      const result = buildDeveloperPersonaResponse(signals);
      expect(result.persona.key).toBe("early_bird");
      expect(result.insights.some(i => i.title === "Early Session")).toBe(true);
    });

    it("should categorize as refactorer when deletions outnumber additions", () => {
      const signals: DeveloperSignals = {
        ...emptySignals,
        commitCountsByDate: { "2026-05-01": 1 },
        additions: 10,
        deletions: 50,
      };

      const result = buildDeveloperPersonaResponse(signals);
      expect(result.persona.key).toBe("refactorer");
      expect(result.insights.some(i => i.title === "Refactoring Powerhouse")).toBe(true);
    });

    it("should categorize as marathoner for long active streaks", () => {
      const commitCountsByDate: Record<string, number> = {};
      const baseDate = new Date("2026-05-01");
      for (let i = 0; i < 15; i++) {
        const nextDate = new Date(baseDate.getTime() + i * 86400000);
        commitCountsByDate[nextDate.toISOString().slice(0, 10)] = 1;
      }

      const signals: DeveloperSignals = {
        ...emptySignals,
        commitCountsByDate,
      };

      const result = buildDeveloperPersonaResponse(signals);
      expect(result.persona.key).toBe("marathoner");
    });

    it("should categorize as speed_runner for fast PR merges", () => {
      const signals: DeveloperSignals = {
        ...emptySignals,
        commitCountsByDate: { "2026-05-01": 5 },
        prMergeSampleSize: 3,
        prMergeTotalHours: 6, // 2 hours avg
      };

      const result = buildDeveloperPersonaResponse(signals);
      expect(result.persona.key).toBe("speed_runner");
      expect(result.insights.some(i => i.title === "PR Champion")).toBe(true);
    });

    it("should compute momentum builder insights correctly", () => {
      // Mock dates for this week and last week
      const today = new Date();
      const thisWeekDay = new Date(today.getTime());
      const lastWeekDay = new Date(today.getTime() - 7 * 86400000);

      const commitCountsByDate = {
        [thisWeekDay.toISOString().slice(0, 10)]: 10,
        [lastWeekDay.toISOString().slice(0, 10)]: 2,
      };

      const signals: DeveloperSignals = {
        ...emptySignals,
        commitCountsByDate,
      };

      const result = buildDeveloperPersonaResponse(signals);
      expect(result.insights.some(i => i.title === "Momentum Builder")).toBe(true);
    });
  });

  describe("calculateStreaks", () => {
    it("returns zeros for empty commit history", () => {
      const result = calculateStreaks({});
      expect(result).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        totalActiveDays: 0,
        currentWeekCommits: 0,
        previousWeekCommits: 0,
        activeDaysThisWeek: 0,
      });
    });

    it("returns correct streak info for single day commit", () => {
      const today = new Date().toISOString().slice(0, 10);
      const result = calculateStreaks({ [today]: 1 });
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.totalActiveDays).toBe(1);
    });

    it("calculates consecutive days correctly", () => {
      const today = new Date();
      const day1 = new Date(today.getTime() - 2 * 86400000).toISOString().slice(0, 10);
      const day2 = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
      const day3 = today.toISOString().slice(0, 10);

      const result = calculateStreaks({
        [day1]: 1,
        [day2]: 2,
        [day3]: 1,
      });
      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(3);
    });

    it("handles gaps in commit history", () => {
      const today = new Date();
      const day1 = new Date(today.getTime() - 4 * 86400000).toISOString().slice(0, 10);
      const day2 = new Date(today.getTime() - 3 * 86400000).toISOString().slice(0, 10);
      const day3 = today.toISOString().slice(0, 10); // gap of 2 days before today

      const result = calculateStreaks({
        [day1]: 1,
        [day2]: 1,
        [day3]: 1,
      });
      expect(result.currentStreak).toBe(1); // because gap is 2 days
      expect(result.longestStreak).toBe(2);
    });
  });

  describe("formatDurationHours", () => {
    it("returns 0h for non-finite values", () => {
      expect(formatDurationHours(NaN)).toBe("0h");
      expect(formatDurationHours(Infinity)).toBe("0h");
      expect(formatDurationHours(-1)).toBe("0h");
      expect(formatDurationHours(0)).toBe("0h");
    });

    it("formats minutes for values less than 1 hour", () => {
      expect(formatDurationHours(0.5)).toBe("30m");
      expect(formatDurationHours(0.25)).toBe("15m");
    });

    it("formats hours for values between 1 and 24", () => {
      expect(formatDurationHours(1)).toBe("1h");
      expect(formatDurationHours(8.5)).toBe("8.5h");
    });

    it("formats days for values 24 or more", () => {
      expect(formatDurationHours(24)).toBe("1d");
      expect(formatDurationHours(48)).toBe("2d");
    });
  });

  describe("choosePersonaCandidate", () => {
    it("returns fallback when no candidates are eligible or scored", () => {
      const candidates = [
        { key: "night_owl" as PersonaKey, score: 0, eligible: false },
        { key: "early_bird" as PersonaKey, score: 0, eligible: false },
      ];
      const result = choosePersonaCandidate(candidates, "balanced_builder");
      expect(result).toBe("balanced_builder");
    });

    it("returns highest scoring eligible candidate", () => {
      const candidates = [
        { key: "night_owl" as PersonaKey, score: 0.8, eligible: true },
        { key: "early_bird" as PersonaKey, score: 0.6, eligible: true },
      ];
      const result = choosePersonaCandidate(candidates, "balanced_builder");
      expect(result).toBe("night_owl");
    });

    it("returns highest scored when no eligible ones exist but scored candidates exist", () => {
      const candidates = [
        { key: "night_owl" as PersonaKey, score: 0.8, eligible: false },
        { key: "early_bird" as PersonaKey, score: 0.6, eligible: false },
      ];
      const result = choosePersonaCandidate(candidates, "balanced_builder");
      expect(result).toBe("night_owl");
    });
  });

  describe("buildSmartInsightCandidates", () => {
    it("returns empty array for no signals", () => {
      const signals: DeveloperSignals = {
        commitCountsByDate: {},
        timeBlocks: { morning: 0, afternoon: 0, evening: 0, night: 0 },
        prsOpened: 0,
        prsMerged: 0,
        prMergeTotalHours: 0,
        prMergeSampleSize: 0,
        additions: 0,
        deletions: 0,
      };
      const summary = calculateStreaks({});
      const result = buildSmartInsightCandidates(signals, summary, "balanced_builder");
      expect(result).toEqual([]);
    });

    it("returns steady cadence insight when no other insights apply", () => {
      const signals: DeveloperSignals = {
        commitCountsByDate: { "2026-05-10": 1, "2026-05-11": 2 },
        timeBlocks: { morning: 5, afternoon: 5, evening: 5, night: 0 },
        prsOpened: 0,
        prsMerged: 0,
        prMergeTotalHours: 0,
        prMergeSampleSize: 0,
        additions: 0,
        deletions: 0,
      };
      const summary = calculateStreaks(signals.commitCountsByDate);
      const result = buildSmartInsightCandidates(signals, summary, "balanced_builder");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].title).toBe("Steady Cadence");
    });
  });
});
