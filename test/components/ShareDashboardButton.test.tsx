import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import ShareDashboardButton from "@/components/ShareDashboardButton";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

vi.mock("next-auth/react");
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedUseSession = useSession as ReturnType<typeof vi.fn>;

describe("ShareDashboardButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("is disabled while session is loading", () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "loading",
    });

    render(<ShareDashboardButton />);

    expect(
      screen.getByRole("button", { name: /share dashboard/i }),
    ).toBeDisabled();
  });

  it("is disabled when unauthenticated", () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<ShareDashboardButton />);

    expect(
      screen.getByRole("button", { name: /share dashboard/i }),
    ).toBeDisabled();
  });

  it("copies public profile URL and shows success toast", async () => {
    mockedUseSession.mockReturnValue({
      data: { githubLogin: "testuser" },
      status: "authenticated",
    });

    render(<ShareDashboardButton />);

    fireEvent.click(
      screen.getByRole("button", { name: /share dashboard/i }),
    );

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "http://localhost:3000/u/testuser",
      );
      expect(toast.success).toHaveBeenCalledWith(
        "Public profile link copied!",
        { duration: 2000 },
      );
    });
  });

  it("shows error toast when clipboard write fails", async () => {
    mockedUseSession.mockReturnValue({
      data: { githubLogin: "testuser" },
      status: "authenticated",
    });
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error("denied"),
    );

    render(<ShareDashboardButton />);

    fireEvent.click(
      screen.getByRole("button", { name: /share dashboard/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to copy link.");
    });
  });
});
