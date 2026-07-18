import { describe, it, expect } from "vitest";
import { mergeCIAnalytics } from "../src/lib/ci-analytics";
import type { CIAnalyticsResponse } from "../src/lib/ci-analytics";

describe("mergeCIAnalytics", () => {
  it("merges two empty responses", () => {
    const a: CIAnalyticsResponse = {
      successRate: 0, averageDurationMinutes: 0, flakiestWorkflow: null, totalRuns: 0, reposChecked: 0,
    };
    const b: CIAnalyticsResponse = {
      successRate: 0, averageDurationMinutes: 0, flakiestWorkflow: null, totalRuns: 0, reposChecked: 0,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.totalRuns).toBe(0);
    expect(result.successRate).toBe(0);
  });

  it("merges responses with 100% success rate", () => {
    const a: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 20, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.totalRuns).toBe(20);
    expect(result.successRate).toBe(100);
  });

  it("calculates weighted average duration", () => {
    const a: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 20, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.averageDurationMinutes).toBe(15);
  });

  it("merges success rates correctly", () => {
    const a: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: "workflow1", totalRuns: 10, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 10, flakiestWorkflow: "workflow2", totalRuns: 10, reposChecked: 1,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.totalRuns).toBe(20);
    expect(result.successRate).toBe(75);
  });

  it("selects flakiest workflow from first when both have failures", () => {
    const a: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: "workflow1", totalRuns: 10, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: "workflow2", totalRuns: 10, reposChecked: 1,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.flakiestWorkflow).toBe("workflow1");
  });

  it("uses flakiest from second when first is null", () => {
    const a: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: "workflow2", totalRuns: 10, reposChecked: 1,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.flakiestWorkflow).toBe("workflow2");
  });

  it("accumulates reposChecked", () => {
    const a: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 5, reposChecked: 3,
    };
    const b: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 5, reposChecked: 2,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.reposChecked).toBe(5);
  });

  it("merges failed repos arrays", () => {
    const a: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1, failedRepos: ["repo1"],
    };
    const b: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1, failedRepos: ["repo2"],
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.failedRepos).toEqual(["repo1", "repo2"]);
  });

  it("handles undefined failedRepos", () => {
    const a: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1, failedRepos: ["repo2"],
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.failedRepos).toEqual(["repo2"]);
  });

  it("calculates weighted average success rate across varying run counts correctly", () => {
    const a: CIAnalyticsResponse = {
      successRate: 50, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 10, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 80, averageDurationMinutes: 10, flakiestWorkflow: null, totalRuns: 20, reposChecked: 1,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.totalRuns).toBe(30);
    expect(result.successRate).toBe(70); // (0.5 * 10 + 0.8 * 20) / 30 = 21 / 30 = 70%
  });

  it("merges multiple accounts/responses correctly using reduce", () => {
    const accounts: CIAnalyticsResponse[] = [
      {
        successRate: 80, averageDurationMinutes: 10, flakiestWorkflow: "workflowA", totalRuns: 10, reposChecked: 2, failedRepos: ["repoA"],
      },
      {
        successRate: 90, averageDurationMinutes: 5, flakiestWorkflow: "workflowB", totalRuns: 20, reposChecked: 3, failedRepos: ["repoB"],
      },
      {
        successRate: 50, averageDurationMinutes: 15, flakiestWorkflow: null, totalRuns: 6, reposChecked: 1, failedRepos: [],
      },
    ];
    
    const result = accounts.reduce(mergeCIAnalytics);
    
    expect(result.totalRuns).toBe(36);
    expect(result.reposChecked).toBe(6);
    expect(result.successRate).toBe(81);
    expect(result.averageDurationMinutes).toBe(8.1);
    expect(result.flakiestWorkflow).toBe("workflowA");
    expect(result.failedRepos).toEqual(["repoA", "repoB"]);
  });

  it("handles mixed case where one response has zero runs and the other has active runs", () => {
    const a: CIAnalyticsResponse = {
      successRate: 0, averageDurationMinutes: 0, flakiestWorkflow: null, totalRuns: 0, reposChecked: 0, failedRepos: [],
    };
    const b: CIAnalyticsResponse = {
      successRate: 75, averageDurationMinutes: 12.5, flakiestWorkflow: "workflow_b", totalRuns: 8, reposChecked: 2, failedRepos: ["repo2"],
    };
    
    // Case 1: Empty first, active second
    const result1 = mergeCIAnalytics(a, b);
    expect(result1.totalRuns).toBe(8);
    expect(result1.successRate).toBe(75);
    expect(result1.averageDurationMinutes).toBe(12.5);
    expect(result1.flakiestWorkflow).toBe("workflow_b");
    expect(result1.reposChecked).toBe(2);
    expect(result1.failedRepos).toEqual(["repo2"]);

    // Case 2: Active first, empty second
    const result2 = mergeCIAnalytics(b, a);
    expect(result2.totalRuns).toBe(8);
    expect(result2.successRate).toBe(75);
    expect(result2.averageDurationMinutes).toBe(12.5);
    expect(result2.flakiestWorkflow).toBe("workflow_b");
    expect(result2.reposChecked).toBe(2);
    expect(result2.failedRepos).toEqual(["repo2"]);
  });

  it("returns empty failedRepos when both are undefined", () => {
    const a: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 5, flakiestWorkflow: null, totalRuns: 5, reposChecked: 1,
    };
    const b: CIAnalyticsResponse = {
      successRate: 100, averageDurationMinutes: 5, flakiestWorkflow: null, totalRuns: 5, reposChecked: 1,
    };
    const result = mergeCIAnalytics(a, b);
    expect(result.failedRepos).toEqual([]);
  });

  it("merges single account with zero default safely", () => {
    const zeroDefault: CIAnalyticsResponse = {
      successRate: 0, averageDurationMinutes: 0, flakiestWorkflow: null, totalRuns: 0, reposChecked: 0, failedRepos: [],
    };
    const account: CIAnalyticsResponse = {
      successRate: 80, averageDurationMinutes: 7.2, flakiestWorkflow: "workflowX", totalRuns: 15, reposChecked: 4, failedRepos: ["repoY"],
    };
    const result = mergeCIAnalytics(account, zeroDefault);
    expect(result.totalRuns).toBe(15);
    expect(result.successRate).toBe(80);
    expect(result.averageDurationMinutes).toBe(7.2);
    expect(result.flakiestWorkflow).toBe("workflowX");
    expect(result.reposChecked).toBe(4);
    expect(result.failedRepos).toEqual(["repoY"]);
  });
});
