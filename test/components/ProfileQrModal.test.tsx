import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProfileQrModal } from "../../src/components/ProfileQrModal";

describe("ProfileQrModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    username: "john_doe",
    profileUrl: "https://devtrack.mock/u/john_doe",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document.body style
    document.body.style.overflow = "unset";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(<ProfileQrModal {...defaultProps}/>);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal content when isOpen is true", () => {
    const { container } = render(<ProfileQrModal {...defaultProps} />);

    // Check heading
    expect(screen.getByRole("heading", { name: /Share Profile QR/i })).toBeInTheDocument();
    
    // Check helper description
    expect(
      screen.getByText(/Scan with a phone camera to quickly view @john_doe's profile on DevTrack/i)
    ).toBeInTheDocument();

    // Check close button
    expect(screen.getByRole("button", { name: /Close modal/i })).toBeInTheDocument();

    // Check QR code canvas is rendered
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    render(<ProfileQrModal {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: /Close modal/i });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    render(<ProfileQrModal {...defaultProps} />);

    // Click backdrop using stable testid
    const backdrop = screen.getByTestId("qr-modal-backdrop");
    fireEvent.click(backdrop);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    render(<ProfileQrModal {...defaultProps} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("locks and unlocks body scroll appropriately", () => {
    const { unmount } = render(<ProfileQrModal {...defaultProps} />);

    // When modal is open, overflow should be hidden
    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    // When unmounted/closed, overflow should be restored
    expect(document.body.style.overflow).toBe("unset");
  });

  it("triggers download of QR code when download button is clicked", () => {
    render(<ProfileQrModal {...defaultProps} />);

    // Mock HTMLCanvasElement.prototype.toDataURL cleanly via spyOn
    const toDataURLSpy = vi.spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,mocked_image_data");

    // Spy on document.createElement capturing original implementation to avoid infinite recursion
    const originalCreateElement = document.createElement.bind(document);
    const linkClickSpy = vi.fn();
    const linkMock = {
      href: "",
      download: "",
      click: linkClickSpy,
    };
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") {
        return linkMock as any;
      }
      return originalCreateElement(tagName);
    });

    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => ({} as any));
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => ({} as any));

    const downloadButton = screen.getByRole("button", { name: /Download QR Code/i });
    fireEvent.click(downloadButton);

    // Verify canvas toDataURL was called
    expect(toDataURLSpy).toHaveBeenCalledWith("image/png");

    // Verify link properties and interaction
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(linkClickSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    // Verify filename and href URL properties are assigned correctly
    expect(linkMock.download).toBe("john_doe-devtrack-qr.png");
    expect(linkMock.href).toBe("data:image/png;base64,mocked_image_data");
  });
});
