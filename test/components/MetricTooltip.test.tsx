import { describe, it, expect } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import MetricTooltip from "@/components/ui/MetricTooltip";

describe("MetricTooltip Component (Issue #2329)", () => {
  it("renders trigger button with accessible label", () => {
    const { getByRole } = render(
      <MetricTooltip
        content="Percentage of pull requests that were successfully merged."
        label="About Merge Rate"
      />
    );

    const button = getByRole("button", { name: "About Merge Rate" });
    expect(button).toBeTruthy();
    expect(button.textContent).toBe("?");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders tooltip content with role='tooltip'", () => {
    const { getByRole } = render(
      <MetricTooltip content="Indicates how consistently you contribute over time." />
    );

    const tooltip = getByRole("tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip.textContent).toContain("Indicates how consistently you contribute over time.");
  });

  it("toggles open state on button click for mobile/touch accessibility", () => {
    const { getByRole } = render(
      <MetricTooltip content="Average cycle time from opening to merge." label="Cycle Time Info" />
    );

    const button = getByRole("button", { name: "Cycle Time Info" });
    const tooltip = getByRole("tooltip");

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(tooltip.className).toContain("opacity-0");

    // Click to open
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(tooltip.className).toContain("opacity-100");

    // Blur to close
    fireEvent.blur(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
