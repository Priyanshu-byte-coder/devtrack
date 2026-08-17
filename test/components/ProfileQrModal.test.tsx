import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProfileQrModal } from "../../src/components/ProfileQrModal";

/**
 * ProfileQrModal has no `isOpen` prop — the parent mounts it conditionally, as
 * its usage docblock shows. These tests therefore cover the mounted component.
 */
describe("ProfileQrModal", () => {
  const onClose = vi.fn();
  const defaultProps = {
    onClose,
    username: "john_doe",
    profileUrl: "https://devtrack.mock/u/john_doe",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the heading, description, profile URL and QR canvas", () => {
    const { container } = render(<ProfileQrModal {...defaultProps} />);

    expect(
      screen.getByRole("heading", { name: /Share Profile/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/@john_doe/)).toBeInTheDocument();
    expect(
      screen.getByText("https://devtrack.mock/u/john_doe")
    ).toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("exposes the panel as a labelled modal dialog", () => {
    render(<ProfileQrModal {...defaultProps} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "qr-modal-title");
  });

  it("calls onClose when the close button is clicked", () => {
    render(<ProfileQrModal {...defaultProps} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Close QR code modal/i })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop itself is clicked", () => {
    render(<ProfileQrModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("dialog"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when a click lands inside the panel", () => {
    render(<ProfileQrModal {...defaultProps} />);

    fireEvent.click(screen.getByRole("heading", { name: /Share Profile/i }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", () => {
    render(<ProfileQrModal {...defaultProps} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks body scroll while mounted and releases it on unmount", () => {
    const { unmount } = render(<ProfileQrModal {...defaultProps} />);

    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    // Cleanup clears the inline style rather than writing a keyword, so the
    // stylesheet takes over again.
    expect(document.body.style.overflow).toBe("");
  });

  it("downloads the QR code as a PNG named after the user", () => {
    const toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue("data:image/png;base64,mocked_image_data");

    const originalCreateElement = document.createElement.bind(document);
    const linkClickSpy = vi.fn();
    const linkMock = { href: "", download: "", click: linkClickSpy };
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) =>
      tagName === "a" ? (linkMock as never) : originalCreateElement(tagName)
    );

    render(<ProfileQrModal {...defaultProps} />);

    // jsdom has no 2D context, so getContext returns null and the handler bails
    // before drawing. Stub it only after the QR canvas has painted, so
    // qrcode.react still gets the real (null-guarded) context during render.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    fireEvent.click(screen.getByRole("button", { name: /Download QR Code/i }));

    expect(toDataURLSpy).toHaveBeenCalledWith("image/png");
    expect(linkClickSpy).toHaveBeenCalledTimes(1);
    expect(linkMock.href).toBe("data:image/png;base64,mocked_image_data");
    expect(linkMock.download).toBe("devtrack-john_doe-qr.png");
  });
});
