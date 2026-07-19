import React, { useEffect } from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  DashboardWidgetA11yProvider,
  useDashboardWidgetA11y,
  useDashboardWidgetA11yState,
} from "../../src/components/dashboard/DashboardWidgetA11yContext";
import DashboardWidgetShell from "../../src/components/dashboard/DashboardWidgetShell";

function SummaryProbe() {
  const { setSummary } = useDashboardWidgetA11y("goal-tracker");
  const { summary } = useDashboardWidgetA11yState("goal-tracker");

  useEffect(() => {
    setSummary("3 active goals. 1 completed.");
  }, [setSummary]);

  return <p data-testid="summary-probe">{summary}</p>;
}

function BusyProbe() {
  const { setIsUpdating } = useDashboardWidgetA11y("pr-metrics");

  useEffect(() => {
    setIsUpdating(true);
  }, [setIsUpdating]);

  return null;
}

describe("DashboardWidgetA11yContext", () => {
  it("setSummary updates announced text for widget id", async () => {
    render(
      <DashboardWidgetA11yProvider>
        <SummaryProbe />
        <DashboardWidgetShell
          widgetId="goal-tracker"
          title="Goal Tracker"
          isEditing={false}
        >
          <button type="button">Add goal</button>
        </DashboardWidgetShell>
      </DashboardWidgetA11yProvider>,
    );

    expect(await screen.findByTestId("summary-probe")).toHaveTextContent(
      "3 active goals. 1 completed.",
    );
    expect(
      within(screen.getByRole("region")).getByText("3 active goals. 1 completed."),
    ).toHaveAttribute("id", "goal-tracker-summary");
  });

  it("setIsUpdating toggles aria-busy on the shell", () => {
    render(
      <DashboardWidgetA11yProvider>
        <BusyProbe />
        <DashboardWidgetShell
          widgetId="pr-metrics"
          title="PR Metrics"
          isEditing={false}
        >
          <button type="button">Refresh</button>
        </DashboardWidgetShell>
      </DashboardWidgetA11yProvider>,
    );

    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true");
  });
});
