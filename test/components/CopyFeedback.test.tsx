import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CopyFeedback } from "@/components/ui/copy-feedback";

const icon = (container: HTMLElement, name: "copy" | "check") =>
  container.querySelector(`svg.lucide-${name}`);

describe("CopyFeedback", () => {
  it("shows the copy icon and label before copying", () => {
    const { container } = render(
      <CopyFeedback copied={false} label="Copy link" />
    );

    expect(screen.getByText("Copy link")).toBeInTheDocument();
    expect(icon(container, "copy")).not.toBeNull();
    expect(icon(container, "check")).toBeNull();
  });

  it("swaps to an animated checkmark and the copied label after copying", () => {
    const { container } = render(<CopyFeedback copied label="Copy link" />);

    expect(screen.getByText("Copied!")).toBeInTheDocument();
    expect(screen.queryByText("Copy link")).toBeNull();
    const check = icon(container, "check");
    expect(check).not.toBeNull();
    expect(check).toHaveClass("motion-safe:animate-copy-pop");
    expect(check).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveClass("text-[var(--success)]");
  });

  it("uses a custom copied label", () => {
    render(<CopyFeedback copied label="Copy" copiedLabel="Done" />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows only the copied label on a button that is an icon at rest", () => {
    const { container, rerender } = render(<CopyFeedback copied={false} />);
    expect(container.textContent).toBe("");

    rerender(<CopyFeedback copied />);
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("never shows text when icon-only", () => {
    const { container } = render(<CopyFeedback copied iconOnly />);
    expect(container.textContent).toBe("");
    expect(icon(container, "check")).not.toBeNull();
  });

  it("lets a button on an accent fill keep its own text colour", () => {
    const { container } = render(
      <CopyFeedback copied label="Copy" copiedClassName="" />
    );
    expect(container.firstElementChild).not.toHaveClass(
      "text-[var(--success)]"
    );
  });

  it("passes icon sizing through", () => {
    const { container } = render(
      <CopyFeedback copied={false} iconClassName="h-4 w-4" />
    );
    expect(icon(container, "copy")).toHaveClass("h-4", "w-4");
    expect(icon(container, "copy")).not.toHaveClass("h-3.5");
  });
});
