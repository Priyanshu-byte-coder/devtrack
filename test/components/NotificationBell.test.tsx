import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "../../src/components/NotificationBell";

function createJsonResponse(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const mockNotifications = [
  {
    id: "notif-1",
    type: "pull_request",
    message: "PR #42 was approved by octocat",
    read: false,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago
  },
  {
    id: "notif-2",
    type: "streak",
    message: "You achieved a 7-day streak!",
    read: true,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
  },
  {
    id: "notif-3",
    type: "issue",
    message: "Issue #100 was closed by maintainer",
    read: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2d ago
  },
];

describe("NotificationBell", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders loading state while initial fetch is pending", async () => {
    // Keep the promise pending
    fetchMock.mockImplementation(() => new Promise(() => {}));

    render(<NotificationBell />);

    // Open bell dropdown
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Loading notifications…")).toBeInTheDocument();
  });

  it("renders error state when API request fails and allows retry", async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return createJsonResponse(200, { success: true });
      }
      callCount++;
      if (callCount <= 2) {
        return createJsonResponse(500, { error: "Database error" });
      }
      return createJsonResponse(200, {
        notifications: mockNotifications,
        unreadCount: 2,
      });
    });

    render(<NotificationBell />);

    // Open dropdown to see error UI
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(
      await screen.findByText("Failed to load notifications")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to fetch notifications \(500\)/)
    ).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeInTheDocument();

    // Click retry
    await act(async () => {
      fireEvent.click(retryButton);
    });

    // Should refetch and show loaded notifications
    expect(
      await screen.findByText("PR #42 was approved by octocat")
    ).toBeInTheDocument();
  });

  it("renders empty state when there are no notifications", async () => {
    fetchMock.mockImplementation(async () => {
      return createJsonResponse(200, { notifications: [], unreadCount: 0 });
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Announcement live region
    expect(
      await screen.findByText("No unread notifications")
    ).toBeInTheDocument();

    // No badge rendered
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    // Open dropdown
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    });

    expect(screen.getByText("All caught up")).toBeInTheDocument();
    expect(screen.getByText("No notifications yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Clear all notifications" })
    ).not.toBeInTheDocument();
  });

  it("renders main notification items and badges with realistic data", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return createJsonResponse(200, { success: true });
      }
      return createJsonResponse(200, {
        notifications: mockNotifications,
        unreadCount: 2,
      });
    });

    render(<NotificationBell />);

    // Bell announcement and badge before opening
    expect(
      await screen.findByText("2 unread notifications")
    ).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Open dropdown
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    });

    // Notifications title and clear button
    expect(
      screen.getByRole("heading", { name: "Notifications" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear all notifications" })
    ).toBeInTheDocument();

    // Content messages
    expect(
      screen.getByText("PR #42 was approved by octocat")
    ).toBeInTheDocument();
    expect(
      screen.getByText("You achieved a 7-day streak!")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Issue #100 was closed by maintainer")
    ).toBeInTheDocument();

    // Timestamps
    expect(screen.getByText("5m ago")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  it("caps unread badge at 9+ when count exceeds 9", async () => {
    fetchMock.mockImplementation(async () => {
      return createJsonResponse(200, {
        notifications: mockNotifications,
        unreadCount: 15,
      });
    });

    render(<NotificationBell />);

    expect(await screen.findByText("9+")).toBeInTheDocument();
    expect(screen.getByText("15 unread notifications")).toBeInTheDocument();
  });

  it("opens and closes dropdown via close button and pointerdown outside", async () => {
    fetchMock.mockImplementation(async () => {
      return createJsonResponse(200, {
        notifications: mockNotifications,
        unreadCount: 0,
      });
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const bellButton = screen.getByRole("button", { name: "Notifications" });

    await act(async () => {
      fireEvent.click(bellButton);
    });

    // Dropdown is open
    expect(
      screen.getByRole("heading", { name: "Notifications" })
    ).toBeInTheDocument();

    // Close via close button
    const closeButton = screen.getByRole("button", {
      name: "Close notifications",
    });
    await act(async () => {
      fireEvent.click(closeButton);
    });

    expect(
      screen.queryByRole("heading", { name: "Notifications" })
    ).not.toBeInTheDocument();

    // Re-open and close via outside click
    await act(async () => {
      fireEvent.click(bellButton);
    });
    expect(
      screen.getByRole("heading", { name: "Notifications" })
    ).toBeInTheDocument();

    await act(async () => {
      document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });

    expect(
      screen.queryByRole("heading", { name: "Notifications" })
    ).not.toBeInTheDocument();
  });

  it("filters notifications by search query and allows clearing search", async () => {
    fetchMock.mockImplementation(async () => {
      return createJsonResponse(200, {
        notifications: mockNotifications,
        unreadCount: 0,
      });
    });

    render(<NotificationBell />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    });

    const searchInput = screen.getByRole("textbox", {
      name: "Search notifications",
    });

    // Search for PR
    fireEvent.change(searchInput, { target: { value: "PR #42" } });

    await waitFor(() => {
      expect(screen.getByText("PR #42")).toBeInTheDocument();
      expect(
        screen.queryByText("You achieved a 7-day streak!")
      ).not.toBeInTheDocument();
    });

    // Clear search button appears
    const clearSearchBtn = screen.getByRole("button", { name: "Clear search" });
    expect(clearSearchBtn).toBeInTheDocument();

    // Search for non-matching query
    fireEvent.change(searchInput, { target: { value: "UnknownKeyword" } });

    await waitFor(() => {
      expect(
        screen.getByText("No results for 'UnknownKeyword'")
      ).toBeInTheDocument();
    });

    // Click clear search
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => {
      expect(
        screen.getByText("You achieved a 7-day streak!")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Issue #100 was closed by maintainer")
      ).toBeInTheDocument();
    });
  });

  it("triggers PATCH /api/notifications when opened with unread items", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return createJsonResponse(200, { success: true });
      }
      return createJsonResponse(200, {
        notifications: mockNotifications,
        unreadCount: 2,
      });
    });

    render(<NotificationBell />);

    expect(await screen.findByText("2")).toBeInTheDocument();

    // Click bell
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    });

    // PATCH should be invoked
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
        method: "PATCH",
      });
    });

    // Optimistically unread count becomes 0
    expect(screen.getByText("No unread notifications")).toBeInTheDocument();
    expect(localStorage.getItem("devtrack:unread-notification-count")).toBe(
      "0"
    );
  });

  it("triggers DELETE /api/notifications when Clear all is clicked", async () => {
    let cleared = false;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        cleared = true;
        return createJsonResponse(200, { success: true });
      }
      if (cleared) {
        return createJsonResponse(200, { notifications: [], unreadCount: 0 });
      }
      return createJsonResponse(200, {
        notifications: mockNotifications,
        unreadCount: 0,
      });
    });

    render(<NotificationBell />);

    // Wait for initial notifications to load
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    });

    const clearAllButton = await screen.findByRole("button", {
      name: "Clear all notifications",
    });
    await act(async () => {
      fireEvent.click(clearAllButton);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
        method: "DELETE",
      });
    });

    expect(localStorage.getItem("devtrack:unread-notification-count")).toBe(
      "0"
    );
  });
});
