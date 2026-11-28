import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import WebhookManager from "../../src/components/webhook/WebhookManager";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const mockWebhook = {
  id: "wh-1",
  name: "CI Alerts",
  url: "https://example.com/hooks/ci",
  events: ["push", "pull_request"],
  is_enabled: true,
  created_at: "2026-11-20T10:00:00.000Z",
  updated_at: "2026-11-20T10:00:00.000Z",
};

describe("WebhookManager confirm modals", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    let listCalls = 0;
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/webhooks/custom" && method === "GET") {
        listCalls += 1;
        return Promise.resolve(
          jsonResponse({ webhooks: listCalls === 1 ? [mockWebhook] : [] }),
        );
      }
      if (url === "/api/webhooks/custom/wh-1" && method === "GET") {
        return Promise.resolve(
          jsonResponse({ webhook: { ...mockWebhook, deliveries: [] } }),
        );
      }
      if (url === "/api/webhooks/custom/wh-1" && method === "DELETE") {
        return Promise.resolve(jsonResponse({ success: true }));
      }
      if (
        url === "/api/webhooks/custom/wh-1/rotate-secret" &&
        method === "POST"
      ) {
        return Promise.resolve(jsonResponse({ secretKey: "whsec_new_123" }));
      }
      return Promise.resolve(jsonResponse({ error: "Not found" }, 404));
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function renderWithWebhook() {
    render(<WebhookManager />);
    await waitFor(() =>
      expect(screen.getByText("CI Alerts")).toBeInTheDocument(),
    );
  }

  it("asks for confirmation before deleting, and cancels without a request", async () => {
    await renderWithWebhook();

    fireEvent.click(screen.getByTitle("Delete webhook"));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(
        "Are you sure you want to delete this webhook? This action cannot be undone.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/webhooks/custom/wh-1", {
      method: "DELETE",
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Keep Webhook" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("CI Alerts")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/webhooks/custom/wh-1", {
      method: "DELETE",
    });
  });

  it("deletes the webhook after confirming in the modal", async () => {
    await renderWithWebhook();

    fireEvent.click(screen.getByTitle("Delete webhook"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete Webhook" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/webhooks/custom/wh-1", {
        method: "DELETE",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("CI Alerts")).not.toBeInTheDocument(),
    );
  });

  it("asks for confirmation before rotating, and rotates after confirming", async () => {
    await renderWithWebhook();

    fireEvent.click(screen.getByTitle("View details"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Rotate Secret" }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Rotate Secret" }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Your endpoint will need to use the new key."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/webhooks/custom/wh-1/rotate-secret",
      { method: "POST" },
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Rotate Secret" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/webhooks/custom/wh-1/rotate-secret",
        { method: "POST" },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText("whsec_new_123")).toBeInTheDocument(),
    );
  });
});
