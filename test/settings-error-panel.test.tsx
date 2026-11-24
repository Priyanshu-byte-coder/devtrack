import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsErrorPanel } from "@/app/dashboard/settings/page";

describe("SettingsErrorPanel (#3679)", () => {
  it("renders connection lost title and guidance text", () => {
    render(<SettingsErrorPanel onRetry={() => {}} />);
    expect(screen.getByText("Connection lost")).toBeDefined();
    expect(
      screen.getByText(
        "Failed to load settings. Check your connection and try again."
      )
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDefined();
  });

  it("calls onRetry callback when Retry button is clicked", () => {
    const handleRetry = vi.fn();
    render(<SettingsErrorPanel onRetry={handleRetry} />);
    const button = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(button);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("disables button and shows Retrying... when loading", () => {
    render(<SettingsErrorPanel onRetry={() => {}} loading={true} />);
    const button = screen.getByRole("button", { name: "Retrying..." });
    expect(button.getAttribute("disabled")).toBeDefined();
  });
});
