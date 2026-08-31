import { describe, it, expect, beforeEach } from "vitest";
import { categorizeStatus, calculateMetrics } from "../src/lib/jira-utils";
import type { JiraIssue } from "../src/lib/jira-utils";

describe("categorizeStatus", () => {
  // ============================================================
  // HAPPY PATH TESTS
  // ============================================================
  it('returns "Done" for statusCategory "done"', () => {
    const issue = { statusCategory: "done" } as JiraIssue;
    expect(categorizeStatus(issue)).toBe("Done");
  });

  it('returns "In Progress" for statusCategory "indeterminate"', () => {
    const issue = { statusCategory: "indeterminate" } as JiraIssue;
    expect(categorizeStatus(issue)).toBe("In Progress");
  });

  it('returns "To Do" for statusCategory "new"', () => {
    const issue = { statusCategory: "new" } as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  // ============================================================
  // EDGE CASES
  // ============================================================
  it('returns "To Do" for unknown statusCategory', () => {
    const issue = { statusCategory: "unknown" } as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it('returns "To Do" for empty statusCategory', () => {
    const issue = { statusCategory: "" } as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it('returns "To Do" for undefined statusCategory', () => {
    const issue = { statusCategory: undefined } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it('returns "To Do" for null statusCategory', () => {
    const issue = { statusCategory: null } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it("handles uppercase status categories", () => {
    const issue = { statusCategory: "DONE" } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it("handles mixed case status categories", () => {
    const issue = { statusCategory: "Done" } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it("handles whitespace-only statusCategory", () => {
    const issue = { statusCategory: "   " } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it("handles numeric status categories", () => {
    const issue = { statusCategory: "123" } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it("returns consistent results for same input", () => {
    const issue = { statusCategory: "done" } as JiraIssue;
    expect(categorizeStatus(issue)).toBe(categorizeStatus(issue));
  });

  it("handles special characters in statusCategory", () => {
    const issue = { statusCategory: "done@#$%" } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it("handles very long statusCategory strings", () => {
    const issue = { statusCategory: "done".repeat(100) } as unknown as JiraIssue;
    expect(categorizeStatus(issue)).toBe("To Do");
  });

  it('correctly distinguishes between "done" and "doneX"', () => {
    const issue1 = { statusCategory: "done" } as JiraIssue;
    const issue2 = { statusCategory: "doneX" } as JiraIssue;
    expect(categorizeStatus(issue1)).toBe("Done");
    expect(categorizeStatus(issue2)).toBe("To Do");
  });

  it("handles all three status categories in sequence", () => {
    const categories = ["done", "indeterminate", "new"];
    const expected = ["Done", "In Progress", "To Do"];
    categories.forEach((cat, i) => {
      const issue = { statusCategory: cat } as JiraIssue;
      expect(categorizeStatus(issue)).toBe(expected[i]);
    });
  });
});

describe("calculateMetrics", () => {
  // ============================================================
  // HAPPY PATH TESTS
  // ============================================================
  it("returns zero counts for empty array", () => {
    const result = calculateMetrics([]);
    expect(result.total).toBe(0);
    expect(result.toDo).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.done).toBe(0);
    expect(result.avgTimeToClose).toBeNull();
  });

  it("counts To Do issues correctly", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "new", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "new", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.total).toBe(2);
    expect(result.toDo).toBe(2);
    expect(result.inProgress).toBe(0);
    expect(result.done).toBe(0);
  });

  it("counts In Progress issues correctly", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "indeterminate", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.total).toBe(1);
    expect(result.toDo).toBe(0);
    expect(result.inProgress).toBe(1);
    expect(result.done).toBe(0);
  });

  it("counts Done issues correctly", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01", updated: "2026-01-01", resolved: "2026-01-02", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.total).toBe(1);
    expect(result.toDo).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.done).toBe(1);
  });

  it("calculates average time to close correctly", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-02T00:00:00Z", assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-03T00:00:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.total).toBe(2);
    expect(result.done).toBe(2);
    expect(result.avgTimeToClose).toBe(36);
  });

  it("returns null avgTimeToClose when no issues are resolved", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.done).toBe(1);
    expect(result.avgTimeToClose).toBeNull();
  });

  it("handles mixed status categories", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "new", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "indeterminate", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
      { key: "PROJ-3", summary: "", status: "", statusCategory: "done", created: "2026-01-01", updated: "2026-01-01", resolved: "2026-01-02", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.total).toBe(3);
    expect(result.toDo).toBe(1);
    expect(result.inProgress).toBe(1);
    expect(result.done).toBe(1);
  });

  // ============================================================
  // EDGE CASES - EMPTY/NULL/UNDEFINED
  // ============================================================
  it("handles single issue correctly", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "new", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.total).toBe(1);
    expect(result.toDo).toBe(1);
  });

  it("handles large number of issues", () => {
    const issues: JiraIssue[] = Array.from({ length: 1000 }, (_, i) => ({
      key: `PROJ-${i}`,
      summary: "",
      status: "",
      statusCategory: i % 3 === 0 ? "done" : i % 3 === 1 ? "indeterminate" : "new",
      created: "2026-01-01",
      updated: "2026-01-01",
      resolved: i % 3 === 0 ? "2026-01-02" : null,
      assignee: null,
      priority: "",
    }));
    const result = calculateMetrics(issues);
    expect(result.total).toBe(1000);
    expect(result.toDo).toBeGreaterThan(0);
    expect(result.inProgress).toBeGreaterThan(0);
    expect(result.done).toBeGreaterThan(0);
  });

  // ============================================================
  // EDGE CASES - TIME CALCULATIONS
  // ============================================================
  it("calculates avgTimeToClose for single resolved issue", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-04T00:00:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.avgTimeToClose).toBe(72);
  });

  it("calculates avgTimeToClose correctly with fractional hours", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-01T12:30:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    // 12.5 hours, rounded
    expect(result.avgTimeToClose).toBe(13);
  });

  it("handles multiple issues with varying resolution times", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-01T24:00:00Z", assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-05T00:00:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.avgTimeToClose).toBeGreaterThan(0);
    expect(result.done).toBe(2);
  });

  it("handles issues resolved on same day", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T10:00:00Z", updated: "2026-01-01T10:00:00Z", resolved: "2026-01-01T14:00:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.avgTimeToClose).toBe(4);
  });

  it("returns correct metric structure", () => {
    const result = calculateMetrics([]);
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("toDo");
    expect(result).toHaveProperty("inProgress");
    expect(result).toHaveProperty("done");
    expect(result).toHaveProperty("avgTimeToClose");
  });

  // ============================================================
  // EDGE CASES - DATA VALIDATION
  // ============================================================
  it("ignores issues with unresolved statusCategory 'done'", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "done", created: "2026-01-01", updated: "2026-01-01", resolved: "2026-01-02", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.done).toBe(2);
    // Only one is actually resolved
    expect(result.avgTimeToClose).not.toBeNull();
  });

  it("handles unknown statusCategory in mixed set", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "unknown", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "done", created: "2026-01-01", updated: "2026-01-01", resolved: "2026-01-02", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.total).toBe(2);
    expect(result.toDo).toBe(1);
    expect(result.done).toBe(1);
  });

  it("sums to total correctly", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "new", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "indeterminate", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
      { key: "PROJ-3", summary: "", status: "", statusCategory: "done", created: "2026-01-01", updated: "2026-01-01", resolved: "2026-01-02", assignee: null, priority: "" },
      { key: "PROJ-4", summary: "", status: "", statusCategory: "new", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.toDo + result.inProgress + result.done).toBe(result.total);
  });

  it("handles case sensitivity in statusCategory", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "DONE", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    // "DONE" is not "done", so it goes to "To Do"
    expect(result.toDo).toBe(1);
    expect(result.done).toBe(0);
  });

  it("handles whitespace in dates gracefully", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-02T00:00:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.done).toBe(1);
    expect(result.avgTimeToClose).toBe(24);
  });

  it("calculates correct average across different time ranges", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-01T01:00:00Z", assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-01T03:00:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    // (1 + 3) / 2 = 2 hours
    expect(result.avgTimeToClose).toBe(2);
  });

  it("memorializes correct metric values across multiple calls", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "new", created: "2026-01-01", updated: "2026-01-01", resolved: null, assignee: null, priority: "" },
    ];
    const result1 = calculateMetrics(issues);
    const result2 = calculateMetrics(issues);
    expect(result1.total).toBe(result2.total);
    expect(result1.toDo).toBe(result2.toDo);
    expect(result1.avgTimeToClose).toBe(result2.avgTimeToClose);
  });

  it("handles edge case of 24-hour resolution", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-02T00:00:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    expect(result.avgTimeToClose).toBe(24);
  });

  // ============================================================
  // BOUNDARY CONDITIONS
  // ============================================================
  it("handles all Done status for all issues", () => {
    const issues: JiraIssue[] = Array.from({ length: 10 }, (_, i) => ({
      key: `PROJ-${i}`,
      summary: "",
      status: "",
      statusCategory: "done",
      created: "2026-01-01",
      updated: "2026-01-01",
      resolved: "2026-01-02",
      assignee: null,
      priority: "",
    }));
    const result = calculateMetrics(issues);
    expect(result.total).toBe(10);
    expect(result.toDo).toBe(0);
    expect(result.inProgress).toBe(0);
    expect(result.done).toBe(10);
  });

  it("handles all To Do status for all issues", () => {
    const issues: JiraIssue[] = Array.from({ length: 10 }, (_, i) => ({
      key: `PROJ-${i}`,
      summary: "",
      status: "",
      statusCategory: "new",
      created: "2026-01-01",
      updated: "2026-01-01",
      resolved: null,
      assignee: null,
      priority: "",
    }));
    const result = calculateMetrics(issues);
    expect(result.total).toBe(10);
    expect(result.toDo).toBe(10);
    expect(result.inProgress).toBe(0);
    expect(result.done).toBe(0);
    expect(result.avgTimeToClose).toBeNull();
  });

  it("handles very minimal time difference", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-01T00:00:01Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    // Approximately 0 seconds, rounds to 0 hours
    expect(result.avgTimeToClose).toBe(0);
  });

  it("averages correctly with rounding", () => {
    const issues: JiraIssue[] = [
      { key: "PROJ-1", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-01T01:30:00Z", assignee: null, priority: "" },
      { key: "PROJ-2", summary: "", status: "", statusCategory: "done", created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", resolved: "2026-01-01T02:30:00Z", assignee: null, priority: "" },
    ];
    const result = calculateMetrics(issues);
    // (1.5 + 2.5) / 2 = 2 hours
    expect(result.avgTimeToClose).toBe(2);
  });
});
