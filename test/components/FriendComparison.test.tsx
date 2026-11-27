import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FriendComparison from "../../src/components/FriendComparison";

const STORAGE_KEY = "devtrack:compare_username";

const MOCK_MY_DATA = {
  username: "current-user",
  streak: 12,
  commits30d: 45,
  topLanguage: "TypeScript",
  prs: 8,
  weeklyCommits: [],
  fromCache: false,
};

const MOCK_FRIEND_DATA = {
  username: "friend-user",
  streak: 8,
  commits30d: 32,
  topLanguage: "Python",
  prs: 5,
  weeklyCommits: [],
  fromCache: false,
};

const MOCK_INACTIVE_FRIEND_DATA = {
  username: "inactive-user",
  streak: 0,
  commits30d: 0,
  topLanguage: "Unknown",
  prs: 0,
  weeklyCommits: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("FriendComparison", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("requests own metrics on mount and renders initial idle state", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    expect(
      screen.getByRole("heading", { level: 2, name: /Friend Comparison/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText("See how you stack up against others")
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText("GitHub username…");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");

    const compareBtn = screen.getByRole("button", { name: "Compare" });
    expect(compareBtn).toBeDisabled();

    expect(
      screen.getByText("Enter a username to start comparing")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/metrics/compare?username=me"
      );
    });
  });

  it("displays loading skeleton while comparison request is pending", async () => {
    let resolveCompare: (res: Response) => void;
    const comparePromise = new Promise<Response>((resolve) => {
      resolveCompare = resolve;
    });

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      if (url.includes("/api/metrics/compare?username=friend-user")) {
        return comparePromise;
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    const input = screen.getByPlaceholderText("GitHub username…");
    fireEvent.change(input, { target: { value: "friend-user" } });

    const compareBtn = screen.getByRole("button", { name: "Compare" });
    expect(compareBtn).not.toBeDisabled();

    fireEvent.click(compareBtn);

    // Verify loading container accessibility state
    const loadingContainer = screen.getByLabelText("Loading comparison");
    expect(loadingContainer).toBeInTheDocument();
    expect(loadingContainer).toHaveAttribute("aria-busy", "true");
    expect(compareBtn).toBeDisabled();

    // Stale or empty message not visible while loading
    expect(
      screen.queryByText("Enter a username to start comparing")
    ).not.toBeInTheDocument();

    // Resolve target request
    resolveCompare!(jsonResponse(MOCK_FRIEND_DATA));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Loading comparison")
      ).not.toBeInTheDocument();
    });

    expect(screen.getByText("Streak")).toBeInTheDocument();
  });

  it("displays error message when target comparison request fails", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      if (url.includes("/api/metrics/compare?username=unknown-user")) {
        return Promise.resolve(jsonResponse({ error: "User not found" }, 404));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    const input = screen.getByPlaceholderText("GitHub username…");
    fireEvent.change(input, { target: { value: "unknown-user" } });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    const errorMsg = await screen.findByText("User not found");
    expect(errorMsg).toBeInTheDocument();

    // No metric rows displayed
    expect(screen.queryByText("Streak")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Loading comparison")
    ).not.toBeInTheDocument();

    // Input remains editable for retry
    fireEvent.change(input, { target: { value: "retry-user" } });
    expect(input).toHaveValue("retry-user");
  });

  it("handles username search network failure gracefully without crashing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      if (url.includes("/api/users/search")) {
        return Promise.reject(new Error("Network search error"));
      }
      if (url.includes("/api/metrics/compare?username=octocat")) {
        return Promise.resolve(jsonResponse(MOCK_FRIEND_DATA));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    const input = screen.getByPlaceholderText("GitHub username…");
    fireEvent.change(input, { target: { value: "octocat" } });

    // Advance past the 300ms suggest debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Check search endpoint was queried
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/users/search?q=octocat")
    );

    // Switch back to real timers for async comparison flow
    vi.useRealTimers();

    // Verify input remains usable and subsequent comparison works
    const compareBtn = screen.getByRole("button", { name: "Compare" });
    fireEvent.click(compareBtn);

    await waitFor(() => {
      expect(screen.getByText("Streak")).toBeInTheDocument();
    });
  });

  it("displays no-data state when friend has zero activity in the period", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      if (url.includes("/api/metrics/compare?username=inactive-user")) {
        return Promise.resolve(jsonResponse(MOCK_INACTIVE_FRIEND_DATA));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    const input = screen.getByPlaceholderText("GitHub username…");
    fireEvent.change(input, { target: { value: "inactive-user" } });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    expect(
      await screen.findByText("No comparison data available")
    ).toBeInTheDocument();
    expect(
      screen.getByText("This user has no activity in the selected period")
    ).toBeInTheDocument();

    // Normal comparison statistics are not rendered
    expect(screen.queryByText("Streak")).not.toBeInTheDocument();
    expect(screen.queryByText("Commits")).not.toBeInTheDocument();
    expect(screen.queryByText("PRs")).not.toBeInTheDocument();
  });

  it("renders realistic comparison content and persists compared username", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      if (url.includes("/api/metrics/compare?username=friend-user")) {
        return Promise.resolve(jsonResponse(MOCK_FRIEND_DATA));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    const input = screen.getByPlaceholderText("GitHub username…");
    fireEvent.change(input, { target: { value: "friend-user" } });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    await waitFor(() => {
      expect(screen.getByText("Streak")).toBeInTheDocument();
    });

    // Check streak row
    expect(screen.getByText("12d")).toBeInTheDocument();
    expect(screen.getByText("8d")).toBeInTheDocument();

    // Check commits row
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();

    // Check PRs row
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();

    // Check localStorage persistence
    expect(localStorage.getItem(STORAGE_KEY)).toBe("friend-user");

    // Check custom events dispatched
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "devtrack:compare-user",
        detail: { username: "friend-user" },
      })
    );
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "devtrack:show-commit-activity",
        detail: { username: "friend-user" },
      })
    );
  });

  it("clears comparison state and localStorage when clear button is clicked", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      if (url.includes("/api/metrics/compare?username=friend-user")) {
        return Promise.resolve(jsonResponse(MOCK_FRIEND_DATA));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    const input = screen.getByPlaceholderText("GitHub username…");
    fireEvent.change(input, { target: { value: "friend-user" } });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    await screen.findByText("Streak");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("friend-user");

    // Locate and click the Clear Comparison button
    const clearBtn = screen.getByRole("button", { name: "Clear Comparison" });
    fireEvent.click(clearBtn);

    // Assert state is reset
    expect(screen.queryByText("Streak")).not.toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(
      screen.getByText("Enter a username to start comparing")
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("automatically loads comparison on mount if username was persisted in localStorage", async () => {
    localStorage.setItem(STORAGE_KEY, "saved-user");

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/api/metrics/compare?username=me")) {
        return Promise.resolve(jsonResponse(MOCK_MY_DATA));
      }
      if (url.includes("/api/metrics/compare?username=saved-user")) {
        return Promise.resolve(jsonResponse(MOCK_FRIEND_DATA));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<FriendComparison />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/metrics/compare?username=saved-user")
      );
    });

    expect(await screen.findByText("Streak")).toBeInTheDocument();
  });
});
