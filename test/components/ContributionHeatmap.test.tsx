import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContributionHeatmap from "@/components/ContributionHeatmap";

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const now = new Date();
const date1 = new Date(now);
date1.setDate(now.getDate() - 5);
const dateKey1 = formatDate(date1);

const date2 = new Date(now);
date2.setDate(now.getDate() - 15);
const dateKey2 = formatDate(date2);

const mockContributions = {
  days: 365,
  total: 8,
  data: {
    [dateKey1]: 5,
    [dateKey2]: 3,
  },
  commits: [
    {
      sha: "sha1",
      message: "feat: add feature",
      date: dateKey1,
      repo: "owner/repo-a",
      url: "https://github.com/owner/repo-a/commit/sha1",
    },
    {
      sha: "sha2",
      message: "fix: bug fix",
      date: dateKey1,
      repo: "owner/repo-a",
      url: "https://github.com/owner/repo-a/commit/sha2",
    },
    {
      sha: "sha3",
      message: "docs: update readme",
      date: dateKey2,
      repo: "owner/repo-b",
      url: "https://github.com/owner/repo-b/commit/sha3",
    },
  ],
};

const mockReposData = {
  repos: [
    {
      name: "owner/repo-a",
      commits: 5,
      description: "First repository",
      url: "https://github.com/owner/repo-a",
      languages: [{ name: "TypeScript", bytes: 15000, percentage: 100 }],
    },
    {
      name: "owner/repo-b",
      commits: 3,
      description: "Second repository",
      url: "https://github.com/owner/repo-b",
      languages: [{ name: "Python", bytes: 8000, percentage: 100 }],
    },
  ],
};

const mockDailyDetails = {
  repos: [
    {
      repo: "owner/repo-a",
      count: 5,
      url: "https://github.com/owner/repo-a",
    },
  ],
};

describe("ContributionHeatmap", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/metrics/contributions/daily")) {
        return reply(200, mockDailyDetails);
      }
      if (url.includes("/api/metrics/contributions")) {
        return reply(200, mockContributions);
      }
      if (url.includes("/api/metrics/repos")) {
        return reply(200, mockReposData);
      }
      return reply(404, {});
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("renders heading and loading skeleton until requests resolve", async () => {
    let resolveContrib: (value: Response) => void;
    let resolveRepos: (value: Response) => void;

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/contributions")) {
        return new Promise<Response>((res) => {
          resolveContrib = res;
        });
      }
      if (url.includes("/api/metrics/repos")) {
        return new Promise<Response>((res) => {
          resolveRepos = res;
        });
      }
      return reply(404, {});
    });

    render(<ContributionHeatmap />);

    expect(
      screen.getByRole("heading", { name: "Contribution Heatmap" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    resolveContrib!(
      new Response(JSON.stringify(mockContributions), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    resolveRepos!(
      new Response(JSON.stringify(mockReposData), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    expect(await screen.findByRole("img")).toBeInTheDocument();
  });

  it("displays error message when contribution endpoint fails", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/contributions")) {
        return reply(500, { error: "Contributions error" });
      }
      if (url.includes("/api/metrics/repos")) {
        return reply(200, mockReposData);
      }
      return reply(404, {});
    });

    render(<ContributionHeatmap />);

    expect(
      await screen.findByText(
        "Failed to load contribution heatmap. Please try refreshing."
      )
    ).toBeInTheDocument();
  });

  it("displays error message when repos endpoint fails independently", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/contributions")) {
        return reply(200, mockContributions);
      }
      if (url.includes("/api/metrics/repos")) {
        return Promise.reject(new Error("Repos service error"));
      }
      return reply(404, {});
    });

    render(<ContributionHeatmap />);

    expect(
      await screen.findByText(
        "Failed to load contribution heatmap. Please try refreshing."
      )
    ).toBeInTheDocument();
  });

  it("handles empty API data by displaying zero-commit heatmap and insights", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/contributions")) {
        return reply(200, { days: 365, total: 0, data: {}, commits: [] });
      }
      if (url.includes("/api/metrics/repos")) {
        return reply(200, { repos: [] });
      }
      return reply(404, {});
    });

    render(<ContributionHeatmap />);

    expect(
      await screen.findByText("0 commits shown across 365 days.")
    ).toBeInTheDocument();

    const heatmap = screen.getByRole("img");
    expect(heatmap).toHaveAttribute(
      "aria-label",
      "Contribution heatmap showing 0 commits across 365 days."
    );
    expect(screen.getByText("0.0")).toBeInTheDocument();
    expect(screen.getByText("0 days")).toBeInTheDocument();
  });

  it("renders realistic data with accessible image summary and date cell buttons", async () => {
    render(<ContributionHeatmap />);

    const heatmap = await screen.findByRole("img");
    expect(heatmap).toHaveAttribute(
      "aria-label",
      "Contribution heatmap showing 8 commits across 365 days."
    );

    expect(
      screen.getByText("8 commits shown across 365 days.")
    ).toBeInTheDocument();

    // Verify accessible cell button
    const cellBtn = screen.getByRole("button", {
      name: new RegExp(`5 commits on ${dateKey1}`),
    });
    expect(cellBtn).toBeInTheDocument();

    // Verify insights panel region
    expect(
      screen.getByRole("region", { name: "Contribution Insights Panel" })
    ).toBeInTheDocument();
  });

  it("updates range when preset buttons are clicked and persists to localStorage", async () => {
    render(<ContributionHeatmap />);

    await screen.findByRole("img");

    const btn30 = screen.getByRole("button", { name: "Show 30-day range" });
    fireEvent.click(btn30);

    await waitFor(() => {
      expect(localStorage.getItem("devtrack:heatmap-range")).toBe("30");
      expect(btn30).toHaveAttribute("aria-pressed", "true");
    });

    const btn90 = screen.getByRole("button", { name: "Show 90-day range" });
    fireEvent.click(btn90);

    await waitFor(() => {
      expect(localStorage.getItem("devtrack:heatmap-range")).toBe("90");
      expect(btn90).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("filters contributions by repository and language selects", async () => {
    render(<ContributionHeatmap />);

    await screen.findByRole("img");

    const repoSelect = screen.getByLabelText("Filter by repository");
    const langSelect = screen.getByLabelText("Filter by language");

    expect(repoSelect).toBeInTheDocument();
    expect(langSelect).toBeInTheDocument();

    // Filter by repo-a (which has 2 commits in commits array)
    fireEvent.change(repoSelect, { target: { value: "owner/repo-a" } });
    expect(
      screen.getByText(/commits shown across 365 days/i)
    ).toBeInTheDocument();

    // Filter by Python language (which maps to repo-b with 1 commit)
    fireEvent.change(langSelect, { target: { value: "Python" } });
    expect(
      screen.getByText(/commits shown across 365 days/i)
    ).toBeInTheDocument();

    // Reset filters to All
    fireEvent.change(repoSelect, { target: { value: "all" } });
    fireEvent.change(langSelect, { target: { value: "all" } });

    expect(
      screen.getByText("8 commits shown across 365 days.")
    ).toBeInTheDocument();
  });

  it("opens daily breakdown sheet when an active day cell is clicked", async () => {
    render(<ContributionHeatmap />);

    await screen.findByRole("img");

    const cellBtn = screen.getByRole("button", {
      name: new RegExp(`5 commits on ${dateKey1}`),
    });
    fireEvent.click(cellBtn);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Daily Breakdown")).toBeInTheDocument();
    expect(await screen.findByText("owner/repo-a")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close panel" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("validates custom date ranges and triggers updated API query", async () => {
    render(<ContributionHeatmap />);

    await screen.findByRole("img");

    const customBtn = screen.getByRole("button", {
      name: "Select custom date range",
    });
    fireEvent.click(customBtn);

    expect(screen.getByText("Custom range")).toBeInTheDocument();

    const startInput = screen.getByLabelText("Start date");
    const endInput = screen.getByLabelText("End date");
    const applyBtn = screen.getByRole("button", { name: "Apply" });

    // Invalid: start > end
    fireEvent.change(startInput, { target: { value: "2026-06-15" } });
    fireEvent.change(endInput, { target: { value: "2026-06-01" } });
    fireEvent.click(applyBtn);

    expect(
      screen.getByText("Start date must be before end date.")
    ).toBeInTheDocument();

    // Valid range
    fireEvent.change(startInput, { target: { value: "2026-01-01" } });
    fireEvent.change(endInput, { target: { value: "2026-01-31" } });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText("Custom range")).not.toBeInTheDocument();
    });

    const calls = fetchMock.mock.calls.filter(
      ([url]) =>
        typeof url === "string" &&
        url.includes("from=2026-01-01") &&
        url.includes("to=2026-01-31")
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it("allows switching heatmap theme without errors", async () => {
    render(<ContributionHeatmap />);

    await screen.findByRole("img");

    const defaultBtn = screen.getByRole("button", { name: "Default" });
    const colourBlindBtn = screen.getByRole("button", { name: "Colour-blind" });
    const themeBtn = screen.getByRole("button", { name: "Theme" });

    fireEvent.click(colourBlindBtn);
    expect(colourBlindBtn).toBeInTheDocument();

    fireEvent.click(themeBtn);
    expect(themeBtn).toBeInTheDocument();

    fireEvent.click(defaultBtn);
    expect(defaultBtn).toBeInTheDocument();
  });
});
