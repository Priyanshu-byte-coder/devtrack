import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signOut } from "next-auth/react";
import PrivacySettings from "../../src/components/PrivacySettings";

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PrivacySettings", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    createObjectURLMock = vi
      .spyOn(window.URL, "createObjectURL")
      .mockReturnValue("blob:http://localhost/mock-uuid");
    revokeObjectURLMock = vi
      .spyOn(window.URL, "revokeObjectURL")
      .mockImplementation(() => {});

    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders initial privacy, export, and delete sections with accessible controls", () => {
    render(<PrivacySettings />);

    // Section header
    expect(
      screen.getByRole("heading", { level: 2, name: "Privacy & Data" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage your data and privacy settings")
    ).toBeInTheDocument();

    // Export Data group
    expect(
      screen.getByRole("group", { name: "Export Data" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Download a portable ZIP archive of all your DevTrack data."
      )
    ).toBeInTheDocument();

    const exportBtn = screen.getByRole("button", {
      name: "Download ZIP archive of your data",
    });
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).not.toBeDisabled();
    expect(exportBtn).toHaveAttribute("aria-busy", "false");

    // Delete Account group
    expect(
      screen.getByRole("group", { name: "Delete Account" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Permanently delete all your data from DevTrack. This action cannot be undone."
      )
    ).toBeInTheDocument();

    const deleteTriggerBtn = screen.getByRole("button", {
      name: "Delete My Account",
    });
    expect(deleteTriggerBtn).toBeInTheDocument();
    expect(deleteTriggerBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("displays preparing export loading state while ZIP export is in progress", async () => {
    let resolveExport: (res: Response) => void;
    const exportPromise = new Promise<Response>((resolve) => {
      resolveExport = resolve;
    });
    fetchMock.mockReturnValue(exportPromise);

    render(<PrivacySettings />);

    const exportBtn = screen.getByRole("button", {
      name: "Download ZIP archive of your data",
    });
    fireEvent.click(exportBtn);

    // Verify loading attributes
    expect(exportBtn).toBeDisabled();
    expect(exportBtn).toHaveAttribute("aria-busy", "true");
    expect(exportBtn).toHaveAttribute(
      "aria-label",
      "Preparing ZIP archive of your data"
    );
    expect(screen.getByText("Preparing export…")).toBeInTheDocument();

    // Resolve request
    resolveExport!(
      new Response("PK mock zip content", {
        status: 200,
        headers: { "Content-Type": "application/zip" },
      })
    );

    await waitFor(() => {
      expect(exportBtn).not.toBeDisabled();
    });
    expect(exportBtn).toHaveAttribute("aria-busy", "false");
  });

  it("displays error alert when export API returns a server failure", async () => {
    fetchMock.mockResolvedValue(
      new Response("Service Unavailable", { status: 503 })
    );

    render(<PrivacySettings />);

    const exportBtn = screen.getByRole("button", {
      name: "Download ZIP archive of your data",
    });
    fireEvent.click(exportBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Failed to generate export. Please try again."
    );

    expect(exportBtn).not.toBeDisabled();
    expect(exportBtn).toHaveAttribute("aria-busy", "false");
  });

  it("handles rate-limiting (HTTP 429) on export with formatted retry duration", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ retryAfterSeconds: 120 }, 429));

    render(<PrivacySettings />);

    const exportBtn = screen.getByRole("button", {
      name: "Download ZIP archive of your data",
    });
    fireEvent.click(exportBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You can export once per hour. Please try again in 2 minutes."
    );
  });

  it("handles rate-limiting on export with default 60-minute duration when retry header is missing", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 429));

    render(<PrivacySettings />);

    const exportBtn = screen.getByRole("button", {
      name: "Download ZIP archive of your data",
    });
    fireEvent.click(exportBtn);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "You can export once per hour. Please try again in 60 minutes."
    );
  });

  it("handles successful ZIP export by generating and revoking object URL and showing status message", async () => {
    fetchMock.mockResolvedValue(
      new Response("mock zip binary", {
        status: 200,
        headers: { "Content-Type": "application/zip" },
      })
    );

    render(<PrivacySettings />);

    const exportBtn = screen.getByRole("button", {
      name: "Download ZIP archive of your data",
    });
    fireEvent.click(exportBtn);

    const statusMsg = await screen.findByRole("status");
    expect(statusMsg).toHaveTextContent("Export downloaded successfully.");

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(
      "blob:http://localhost/mock-uuid"
    );
  });

  it("opens delete confirmation panel and enables confirm delete button only when DELETE is entered", () => {
    render(<PrivacySettings />);

    const deleteTriggerBtn = screen.getByRole("button", {
      name: "Delete My Account",
    });
    fireEvent.click(deleteTriggerBtn);

    // Confirmation panel appears
    expect(
      screen.getByText("This will permanently delete:")
    ).toBeInTheDocument();

    const input = screen.getByRole("textbox", {
      name: /Type DELETE to confirm/i,
    });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");

    const confirmBtn = screen.getByRole("button", { name: "Confirm Delete" });
    expect(confirmBtn).toBeDisabled();

    // Type incorrect text
    fireEvent.change(input, { target: { value: "delete" } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: "NO" } });
    expect(confirmBtn).toBeDisabled();

    // Type exact confirmation text
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("cancels delete confirmation and restores delete my account trigger button", () => {
    render(<PrivacySettings />);

    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    expect(
      screen.queryByText("This will permanently delete:")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete My Account" })
    ).toBeInTheDocument();
  });

  it("displays deleting state while delete account request is pending", async () => {
    let resolveDelete: (res: Response) => void;
    const deletePromise = new Promise<Response>((resolve) => {
      resolveDelete = resolve;
    });
    fetchMock.mockReturnValue(deletePromise);

    render(<PrivacySettings />);

    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    const input = screen.getByRole("textbox", {
      name: /Type DELETE to confirm/i,
    });
    fireEvent.change(input, { target: { value: "DELETE" } });

    const confirmBtn = screen.getByRole("button", { name: "Confirm Delete" });
    fireEvent.click(confirmBtn);

    // Verify request details
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/user/data-export",
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: "DELETE" }),
      })
    );

    // Verify deleting button state
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting…" })).toHaveAttribute(
      "aria-busy",
      "true"
    );

    // Resolve with failure to cleanly finish
    resolveDelete!(jsonResponse({ error: "Failed" }, 500));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Confirm Delete" })
      ).toBeInTheDocument();
    });
  });

  it("displays error alert when account deletion fails and prevents sign-out", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Account deletion is unavailable right now." }, 500)
    );

    render(<PrivacySettings />);

    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    const input = screen.getByRole("textbox", {
      name: /Type DELETE to confirm/i,
    });
    fireEvent.change(input, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Account deletion is unavailable right now."
    );

    // Ensure signOut was NOT called
    expect(signOut).not.toHaveBeenCalled();

    // User remains on confirmation panel
    expect(
      screen.getByRole("button", { name: "Confirm Delete" })
    ).toBeInTheDocument();
  });

  it("calls signOut with callbackUrl / upon successful account deletion", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, message: "Account deleted." }, 200)
    );

    render(<PrivacySettings />);

    fireEvent.click(screen.getByRole("button", { name: "Delete My Account" }));

    const input = screen.getByRole("textbox", {
      name: /Type DELETE to confirm/i,
    });
    fireEvent.change(input, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
    });
  });
});
