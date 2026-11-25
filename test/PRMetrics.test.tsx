import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyChart, formatDuration, type MetricStatusFilter } from "@/components/PRMetrics";
import type { PullRequestSummary } from "@/lib/pull-requests";

const sampleWeeks: PullRequestSummary["weeks"] = [
  { weekStart: "2026-11-01", opened: 5, merged: 3 },
  { weekStart: "2026-11-08", opened: 2, merged: 4 },
  { weekStart: "2026-11-15", opened: 7, merged: 6 },
];

describe("PRMetrics - WeeklyChart status filtering (#1488)", () => {
  it("renders both Opened and Merged legends when filter is 'all'", () => {
    render(<WeeklyChart weeks={sampleWeeks} filter="all" />);
    expect(screen.getByText("Opened")).toBeDefined();
    expect(screen.getByText("Merged")).toBeDefined();
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("opened,");
    expect(chart.getAttribute("aria-label")).toContain("merged");
  });

  it("renders only Opened legend and series when filter is 'open'", () => {
    render(<WeeklyChart weeks={sampleWeeks} filter="open" />);
    expect(screen.getByText("Opened")).toBeDefined();
    expect(screen.queryByText("Merged")).toBeNull();
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("opened");
    expect(chart.getAttribute("aria-label")).not.toContain("merged");
  });

  it("renders only Merged legend and series when filter is 'merged'", () => {
    render(<WeeklyChart weeks={sampleWeeks} filter="merged" />);
    expect(screen.queryByText("Opened")).toBeNull();
    expect(screen.getByText("Merged")).toBeDefined();
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("merged");
    expect(chart.getAttribute("aria-label")).not.toContain("opened");
  });
});

describe("PRMetrics - formatDuration", () => {
  it("formats hours accurately", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0.5)).toBe("<1h");
    expect(formatDuration(12)).toBe("12h");
    expect(formatDuration(48)).toBe("2d");
    expect(formatDuration(60)).toBe("2.5d");
  });
});
