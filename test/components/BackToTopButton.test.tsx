import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BackToTopButton from "../../src/components/BackToTopButton";

describe("BackToTopButton", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not render the button initially when scroll Y is 0", () => {
    render(<BackToTopButton />);
    expect(screen.queryByRole("button", { name: "Back to top" })).not.toBeInTheDocument();
  });

  it("should render the button when scroll Y is greater than 300", async () => {
    // Mock window scrollY and document height to trigger visibility
    Object.defineProperty(window, "scrollY", { value: 400, writable: true });
    
    render(<BackToTopButton />);
    
    // Simulate scroll event
    fireEvent.scroll(window);
    
    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button).toBeInTheDocument();
  });

  it("should call window.scrollTo when clicked", () => {
    Object.defineProperty(window, "scrollY", { value: 400, writable: true });
    render(<BackToTopButton />);
    fireEvent.scroll(window);

    const button = screen.getByRole("button", { name: "Back to top" });
    fireEvent.click(button);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  it("should call window.scrollTo when Enter or Space is pressed on the button", () => {
    Object.defineProperty(window, "scrollY", { value: 400, writable: true });
    render(<BackToTopButton />);
    fireEvent.scroll(window);

    const button = screen.getByRole("button", { name: "Back to top" });
    
    // Test Enter key
    fireEvent.keyDown(button, { key: "Enter" });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);

    // Test Space key
    fireEvent.keyDown(button, { key: " " });
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });
});
