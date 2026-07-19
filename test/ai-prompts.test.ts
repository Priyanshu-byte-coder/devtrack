import { describe, it, expect } from "vitest";
import { weeklyProductivityPrompt } from "@/lib/ai-prompts";

describe("weeklyProductivityPrompt", () => {
  it("generates a prompt correctly with the provided metrics", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 5,
      currentStreak: 7,
      totalCommits: 42,
      prsMerged: 3,
      prsOpen: 1,
      avgMergeTimeDays: 2.5,
      topRepoName: "devtrack",
      trendLabel: "+15%",
    });

    expect(prompt).toContain("Active coding days: 5");
    expect(prompt).toContain("Current streak: 7 days");
    expect(prompt).toContain("Total commits (90d): 42");
    expect(prompt).toContain("PRs merged: 3, open: 1");
    expect(prompt).toContain("Avg PR merge time: 2.5 days");
    expect(prompt).toContain("Top repository: devtrack");
    expect(prompt).toContain("Activity trend: +15% vs prior period");
    expect(prompt).toContain("Write a warm, concise 3-sentence weekly summary.");
  });

  // Edge case: Zero values
  it("handles zero active days", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 0,
      currentStreak: 0,
      totalCommits: 10,
      prsMerged: 0,
      prsOpen: 0,
      avgMergeTimeDays: 1.0,
      topRepoName: "repo",
      trendLabel: "0%",
    });

    expect(prompt).toContain("Active coding days: 0");
    expect(prompt).toContain("Current streak: 0 days");
    expect(prompt).toContain("PRs merged: 0, open: 0");
    expect(prompt).toMatch(/Avg PR merge time: 1\.0 days/);
    expect(prompt).toContain("Activity trend: 0% vs prior period");
  });

  it("handles zero total commits", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 3,
      currentStreak: 2,
      totalCommits: 0,
      prsMerged: 1,
      prsOpen: 2,
      avgMergeTimeDays: 0.5,
      topRepoName: "my-repo",
      trendLabel: "-50%",
    });

    expect(prompt).toContain("Total commits (90d): 0");
    expect(prompt).toContain("Active coding days: 3");
    expect(prompt).toContain("PRs merged: 1, open: 2");
    expect(prompt).toContain("Activity trend: -50% vs prior period");
  });

  it("handles zero PRs merged", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 2,
      currentStreak: 1,
      totalCommits: 5,
      prsMerged: 0,
      prsOpen: 3,
      avgMergeTimeDays: 10.0,
      topRepoName: "project",
      trendLabel: "-10%",
    });

    expect(prompt).toContain("PRs merged: 0, open: 3");
    expect(prompt).toContain("Total commits (90d): 5");
  });

  // Edge case: Zero avgMergeTimeDays
  it("handles zero average merge time days", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 7,
      currentStreak: 5,
      totalCommits: 50,
      prsMerged: 5,
      prsOpen: 0,
      avgMergeTimeDays: 0,
      topRepoName: "fast-repo",
      trendLabel: "+100%",
    });

    expect(prompt).toContain("Avg PR merge time: 0.0 days");
    expect(prompt).toContain("PRs merged: 5, open: 0");
  });

  // Edge case: Large numbers
  it("handles very large commit count", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 7,
      currentStreak: 365,
      totalCommits: 99999,
      prsMerged: 999,
      prsOpen: 100,
      avgMergeTimeDays: 50.0,
      topRepoName: "large-project",
      trendLabel: "+500%",
    });

    expect(prompt).toContain("Total commits (90d): 99999");
    expect(prompt).toContain("Current streak: 365 days");
    expect(prompt).toContain("PRs merged: 999, open: 100");
    expect(prompt).toContain("Activity trend: +500% vs prior period");
  });

  it("handles large average merge time", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 5,
      currentStreak: 10,
      totalCommits: 100,
      prsMerged: 2,
      prsOpen: 5,
      avgMergeTimeDays: 365.5,
      topRepoName: "slow-repo",
      trendLabel: "-25%",
    });

    expect(prompt).toContain("Avg PR merge time: 365.5 days");
  });

  // Edge case: Negative streak values
  it("handles negative current streak", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 1,
      currentStreak: -1,
      totalCommits: 3,
      prsMerged: 0,
      prsOpen: 1,
      avgMergeTimeDays: 2.0,
      topRepoName: "test-repo",
      trendLabel: "-100%",
    });

    expect(prompt).toContain("Current streak: -1 days");
    expect(prompt).toContain("Active coding days: 1");
  });

  // Edge case: Empty string for topRepoName
  it("handles empty repository name", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 4,
      currentStreak: 3,
      totalCommits: 25,
      prsMerged: 2,
      prsOpen: 1,
      avgMergeTimeDays: 1.5,
      topRepoName: "",
      trendLabel: "+20%",
    });

    expect(prompt).toContain("Top repository: ");
    expect(prompt).toContain("Activity trend: +20% vs prior period");
  });

  // Edge case: Very long trendLabel
  it("handles very long trend label string", () => {
    const longTrend = "Exceptional growth exceeding all expectations with remarkable improvements across all metrics";
    const prompt = weeklyProductivityPrompt({
      activeDays: 6,
      currentStreak: 15,
      totalCommits: 150,
      prsMerged: 8,
      prsOpen: 2,
      avgMergeTimeDays: 1.2,
      topRepoName: "awesome-project",
      trendLabel: longTrend,
    });

    expect(prompt).toContain(`Activity trend: ${longTrend} vs prior period`);
    expect(prompt).toContain("Total commits (90d): 150");
  });

  // Edge case: All zeros scenario (minimal activity)
  it("handles minimal activity with all zeros except required fields", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 0,
      currentStreak: 0,
      totalCommits: 0,
      prsMerged: 0,
      prsOpen: 0,
      avgMergeTimeDays: 0,
      topRepoName: "",
      trendLabel: "0%",
    });

    expect(prompt).toContain("Active coding days: 0");
    expect(prompt).toContain("Current streak: 0 days");
    expect(prompt).toContain("Total commits (90d): 0");
    expect(prompt).toContain("PRs merged: 0, open: 0");
    expect(prompt).toContain("Avg PR merge time: 0.0 days");
    expect(prompt).toContain("Top repository: ");
    expect(prompt).toContain("Activity trend: 0% vs prior period");
  });

  // Edge case: Decimal precision for avgMergeTimeDays
  it("correctly formats decimal values for average merge time", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 5,
      currentStreak: 4,
      totalCommits: 30,
      prsMerged: 2,
      prsOpen: 1,
      avgMergeTimeDays: 3.456789,
      topRepoName: "precision-test",
      trendLabel: "+5%",
    });

    expect(prompt).toContain("Avg PR merge time: 3.5 days");
  });

  // Edge case: Very small decimal values
  it("handles very small decimal average merge time", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 7,
      currentStreak: 7,
      totalCommits: 70,
      prsMerged: 10,
      prsOpen: 0,
      avgMergeTimeDays: 0.1,
      topRepoName: "fast-merge-repo",
      trendLabel: "+30%",
    });

    expect(prompt).toContain("Avg PR merge time: 0.1 days");
  });

  // Edge case: Negative trend label (valid business scenario)
  it("handles negative trend label string", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 3,
      currentStreak: 2,
      totalCommits: 15,
      prsMerged: 1,
      prsOpen: 2,
      avgMergeTimeDays: 3.0,
      topRepoName: "declining-project",
      trendLabel: "-75%",
    });

    expect(prompt).toContain("Activity trend: -75% vs prior period");
  });

  // Boundary test: Single character repo name
  it("handles single character repository name", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 1,
      currentStreak: 1,
      totalCommits: 1,
      prsMerged: 1,
      prsOpen: 0,
      avgMergeTimeDays: 0.1,
      topRepoName: "a",
      trendLabel: "+1%",
    });

    expect(prompt).toContain("Top repository: a");
  });

  // Integration test: Prompt structure integrity across edge cases
  it("maintains valid prompt structure with extreme values", () => {
    const prompt = weeklyProductivityPrompt({
      activeDays: 0,
      currentStreak: -999,
      totalCommits: 999999,
      prsMerged: 0,
      prsOpen: 0,
      avgMergeTimeDays: 0.001,
      topRepoName: "",
      trendLabel: "EXTREME_VOLATILITY",
    });

    expect(prompt).toContain("You are a senior engineering mentor");
    expect(prompt).toContain("Here is their data:");
    expect(prompt).toContain("Active coding days:");
    expect(prompt).toContain("Current streak:");
    expect(prompt).toContain("Total commits (90d):");
    expect(prompt).toContain("PRs merged:");
    expect(prompt).toContain("Avg PR merge time:");
    expect(prompt).toContain("Top repository:");
    expect(prompt).toContain("Activity trend:");
    expect(prompt).toContain("Write a warm, concise 3-sentence weekly summary");
  });
});
