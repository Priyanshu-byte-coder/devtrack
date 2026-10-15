import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShareProfileSection from "../../src/components/ShareProfileSection";

vi.mock("qrcode.react", () => ({ QRCodeCanvas: () => <canvas /> }));

describe("ShareProfileSection QR code", () => {
  it("opens the QR dialog on demand and closes it again", () => {
    render(
      <ShareProfileSection
        username="octocat"
        streak={3}
        profileUrl="https://devtrack.example/u/octocat"
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /qr code/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close QR code modal" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
