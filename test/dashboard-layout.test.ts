import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  getDefaultDashboardLayout,
  hideWidget,
  moveWidget,
  normalizeDashboardLayout,
  resetDashboardLayout,
  showWidget,
} from "../src/lib/dashboard-layout";

describe("dashboard-layout", () => {
  it("returns default layout for invalid saved layout", () => {
    expect(normalizeDashboardLayout(null)).toEqual(DEFAULT_DASHBOARD_LAYOUT);
    expect(normalizeDashboardLayout("invalid")).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });

  it("removes unknown widget ids and duplicate widgets", () => {
    const layout = normalizeDashboardLayout({
      version: 1,
      sections: ["overview", "activity", "analytics", "goals"],
      widgets: {
        overview: ["weekly-summary", "weekly-summary", "unknown-widget"],
        activity: [],
        analytics: [],
        goals: [],
      },
      hidden: [],
    });

    expect(layout.widgets.overview).toContain("weekly-summary");
    expect(layout.widgets.overview.filter((id) => id === "weekly-summary")).toHaveLength(1);
    expect(JSON.stringify(layout)).not.toContain("unknown-widget");
  });

  it("hides a widget and keeps it in hidden list", () => {
    const layout = hideWidget(getDefaultDashboardLayout(), "weekly-summary");

    expect(layout.widgets.overview).not.toContain("weekly-summary");
    expect(layout.hidden).toContain("weekly-summary");
  });

  it("shows a hidden widget again", () => {
    const hiddenLayout = hideWidget(getDefaultDashboardLayout(), "weekly-summary");
    const visibleLayout = showWidget(hiddenLayout, "weekly-summary");

    expect(visibleLayout.hidden).not.toContain("weekly-summary");
    expect(visibleLayout.widgets.overview).toContain("weekly-summary");
  });

  it("moves a widget between sections", () => {
    const layout = moveWidget(
      getDefaultDashboardLayout(),
      "overview",
      "activity",
      "weekly-summary",
      0,
    );

    expect(layout.widgets.overview).not.toContain("weekly-summary");
    expect(layout.widgets.activity[0]).toBe("weekly-summary");
  });

  it("resets to the default dashboard layout", () => {
    const changedLayout = hideWidget(getDefaultDashboardLayout(), "weekly-summary");

    expect(changedLayout).not.toEqual(DEFAULT_DASHBOARD_LAYOUT);
    expect(resetDashboardLayout()).toEqual(DEFAULT_DASHBOARD_LAYOUT);
  });
});