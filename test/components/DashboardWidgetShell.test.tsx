import React, { useEffect } from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DashboardWidgetShell from "../../src/components/dashboard/DashboardWidgetShell";
import {
  DashboardWidgetA11yProvider,
  useDashboardWidgetA11y,
} from "../../src/components/dashboard/DashboardWidgetA11yContext";

function ShellWithSummary({ summary }: { summary: string }) {
  const { setSummary } = useDashboardWidgetA11y("streak-tracker");

  useEffect(() => {
    setSummary(summary);
  }, [setSummary, summary]);

  return (
    <DashboardWidgetShell
      widgetId="streak-tracker"
      title="Streak Tracker"
      isEditing={false}
    >
      <button type="button">Copy streak</button>
    </DashboardWidgetShell>
  );
}

function renderShell({ isEditing = false }: { isEditing?: boolean } = {}) {
  return render(
    <DashboardWidgetA11yProvider>
      <DashboardWidgetShell
        widgetId="streak-tracker"
        title="Streak Tracker"
        isEditing={isEditing}
      >
        <button type="button">Copy streak</button>
      </DashboardWidgetShell>
    </DashboardWidgetA11yProvider>,
  );
}

describe("DashboardWidgetShell", () => {
  it("renders with tabIndex 0 when not editing", () => {
    renderShell();
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("renders with tabIndex -1 when editing", () => {
    renderShell({ isEditing: true });
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("tabindex", "-1");
  });

  it("focuses the first inner button on Enter", () => {
    renderShell();
    const region = screen.getByRole("region");
    const button = screen.getByRole("button", { name: "Copy streak" });

    region.focus();
    fireEvent.keyDown(region, { key: "Enter" });

    expect(button).toHaveFocus();
  });

  it("shows summary text in the sr-only live region", async () => {
    render(
      <DashboardWidgetA11yProvider>
        <ShellWithSummary summary="Current streak: 42 days. Longest streak: 60 days." />
      </DashboardWidgetA11yProvider>,
    );

    const summary = await screen.findByText(
      "Current streak: 42 days. Longest streak: 60 days.",
    );
    expect(summary).toHaveClass("sr-only");
    expect(summary).toHaveAttribute("aria-live", "polite");
  });
});
