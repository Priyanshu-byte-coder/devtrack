import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ShortcutsModal from "@/components/ShortcutsModal";

describe("ShortcutsModal Accessibility", () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have role='dialog' and aria-modal='true'", () => {
    render(<ShortcutsModal isOpen={true} onClose={onCloseMock} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("should close when Escape key is pressed", () => {
    render(<ShortcutsModal isOpen={true} onClose={onCloseMock} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("should restore focus to the previous active element when closed", () => {
    const buttonOutside = document.createElement("button");
    document.body.appendChild(buttonOutside);
    buttonOutside.focus();

    const { rerender } = render(<ShortcutsModal isOpen={true} onClose={onCloseMock} />);
    
    // Focus should move to the close button inside the modal
    const closeBtn = screen.getByLabelText("Close shortcuts");
    expect(document.activeElement).toBe(closeBtn);

    // Close the modal
    rerender(<ShortcutsModal isOpen={false} onClose={onCloseMock} />);
    
    // Focus should be restored to the button outside
    expect(document.activeElement).toBe(buttonOutside);
    document.body.removeChild(buttonOutside);
  });

  it("should trap focus and cycle forward when Tab is pressed", () => {
    render(<ShortcutsModal isOpen={true} onClose={onCloseMock} />);
    
    const focusableElements = screen.getByRole("dialog").querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements.length).toBeGreaterThan(0);
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus last element
    lastElement.focus();
    expect(document.activeElement).toBe(lastElement);

    // Press Tab
    fireEvent.keyDown(window, { key: "Tab", shiftKey: false });

    // Should cycle to first element
    expect(document.activeElement).toBe(firstElement);
  });

  it("should trap focus and cycle backward when Shift+Tab is pressed", () => {
    render(<ShortcutsModal isOpen={true} onClose={onCloseMock} />);
    
    const focusableElements = screen.getByRole("dialog").querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements.length).toBeGreaterThan(0);
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();
    expect(document.activeElement).toBe(firstElement);

    // Press Shift+Tab
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

    // Should cycle to last element
    expect(document.activeElement).toBe(lastElement);
  });

  it("should recover focus if moved outside programmatically", () => {
    render(<ShortcutsModal isOpen={true} onClose={onCloseMock} />);
    
    const outsideElement = document.createElement("input");
    document.body.appendChild(outsideElement);
    
    // Attempt to focus outside
    outsideElement.focus();
    
    // The handleFocusIn listener should intercept and pull focus back to the close button
    const closeBtn = screen.getByLabelText("Close shortcuts");
    expect(document.activeElement).toBe(closeBtn);
    
    document.body.removeChild(outsideElement);
  });
});
