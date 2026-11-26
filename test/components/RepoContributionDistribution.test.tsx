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
import RepoContributionDistribution from "../../src/components/RepoContributionDistribution";

vi.mock("../../src/components/ThemeContext", () => ({
  useTheme: () => ({ theme: "default" }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_REPOS_PAYLOAD = {
  repos: [
    {
      name: "acme/frontend",
      commits: 42,
      description: "Frontend application",
      url: "https://github.com/acme/frontend",
    },
    {
      name: "acme/backend",
      commits: 18,
      description: "Backend API",
      url: "https://github.com/acme/backend",
    },
    {
      name: "acme/tools",
      commits: 10,
      description: "Developer tools",
      url: "https://github.com/acme/tools",
    },
  ],
  days: 365,
};

describe("RepoContributionDistribution", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // jsdom does not implement ResizeObserver; ResponsiveContainer requires it.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("displays loading state while repository metrics are being fetched", async () => {
    let resolveRepos: (res: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolveRepos = resolve;
    });
    fetchMock.mockReturnValue(pendingPromise);

    render(<RepoContributionDistribution />);

    expect(
      screen.getByText("Loading repository distribution…")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/metrics/repos?days=365");

    // Statistics and empty messages should not be visible while loading
    expect(screen.queryByText("Total commits")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No repository contribution data available yet.")
    ).not.toBeInTheDocument();

    // Settle promise
    resolveRepos!(jsonResponse(SAMPLE_REPOS_PAYLOAD));

    await waitFor(() => {
      expect(
        screen.queryByText("Loading repository distribution…")
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("Total commits")).toBeInTheDocument();
  });

  it("displays error message when the API request returns a server failure", async () => {
    fetchMock.mockResolvedValue(
      new Response("Internal Error", { status: 500 })
    );

    render(<RepoContributionDistribution />);

    const errorContainer = await screen.findByText(
      "Failed to fetch repository metrics."
    );
    expect(errorContainer).toBeInTheDocument();

    // Normal content or empty message should not be visible
    expect(screen.queryByText("Total commits")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No repository contribution data available yet.")
    ).not.toBeInTheDocument();
  });

  it("displays fallback error message when fetch rejects with a network error", async () => {
    fetchMock.mockRejectedValue(new Error("Network connection dropped"));

    render(<RepoContributionDistribution />);

    const errorContainer = await screen.findByText(
      "Network connection dropped"
    );
    expect(errorContainer).toBeInTheDocument();
  });

  it("displays empty state when the API returns an empty repository list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ repos: [] }));

    render(<RepoContributionDistribution />);

    const emptyMsg = await screen.findByText(
      "No repository contribution data available yet."
    );
    expect(emptyMsg).toBeInTheDocument();

    expect(screen.queryByText("Total commits")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Commits per repository" })
    ).not.toBeInTheDocument();
  });

  it("filters out repositories with zero commits and displays empty state if all are zero", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        repos: [
          { name: "acme/inactive-1", commits: 0 },
          { name: "acme/inactive-2", commits: 0 },
        ],
      })
    );

    render(<RepoContributionDistribution />);

    const emptyMsg = await screen.findByText(
      "No repository contribution data available yet."
    );
    expect(emptyMsg).toBeInTheDocument();
  });

  it("renders realistic repository contribution distribution in pie chart mode by default", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SAMPLE_REPOS_PAYLOAD));

    render(<RepoContributionDistribution />);

    // Section title & description
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Repository Contribution Distribution",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Repo-wise contribution share based on recent commit activity."
      )
    ).toBeInTheDocument();

    // Summary statistics cards
    expect(screen.getByText("Repositories")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(screen.getByText("Total commits")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();

    expect(screen.getByText("Top repo")).toBeInTheDocument();
    expect(screen.getAllByTitle("acme/frontend").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText("frontend")).toBeInTheDocument();

    // Chart mode toggle buttons
    const pieBtn = screen.getByRole("button", { name: "Pie" });
    const barBtn = screen.getByRole("button", { name: "Bar" });
    expect(pieBtn).toHaveAttribute("aria-pressed", "true");
    expect(barBtn).toHaveAttribute("aria-pressed", "false");

    // Repository legend (only rendered in pie mode)
    const legend = screen.getByRole("list", { name: "Commits per repository" });
    expect(legend).toBeInTheDocument();

    // Check repository rows with formatted percentages (42/70 = 60%, 18/70 = 25.7%, 10/70 = 14.3%)
    expect(within(legend).getByText("acme/frontend")).toBeInTheDocument();
    expect(screen.getByText("42 · 60%")).toBeInTheDocument();

    expect(screen.getByText("acme/backend")).toBeInTheDocument();
    expect(screen.getByText("18 · 25.7%")).toBeInTheDocument();

    expect(screen.getByText("acme/tools")).toBeInTheDocument();
    expect(screen.getByText("10 · 14.3%")).toBeInTheDocument();
  });

  it("switches from Pie to Bar chart mode and toggles repository legend visibility", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SAMPLE_REPOS_PAYLOAD));

    render(<RepoContributionDistribution />);

    await screen.findByRole("heading", {
      level: 2,
      name: "Repository Contribution Distribution",
    });

    const pieBtn = screen.getByRole("button", { name: "Pie" });
    const barBtn = screen.getByRole("button", { name: "Bar" });

    // Initial state: Pie is active, legend is present
    expect(pieBtn).toHaveAttribute("aria-pressed", "true");
    expect(barBtn).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("list", { name: "Commits per repository" })
    ).toBeInTheDocument();

    // Switch to Bar mode
    fireEvent.click(barBtn);

    expect(barBtn).toHaveAttribute("aria-pressed", "true");
    expect(pieBtn).toHaveAttribute("aria-pressed", "false");

    // In Bar mode, the Pie-only legend list is not rendered
    expect(
      screen.queryByRole("list", { name: "Commits per repository" })
    ).not.toBeInTheDocument();

    // Summary statistics remain visible
    expect(screen.getByText("Total commits")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();

    // Switch back to Pie mode
    fireEvent.click(pieBtn);

    expect(pieBtn).toHaveAttribute("aria-pressed", "true");
    expect(barBtn).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("list", { name: "Commits per repository" })
    ).toBeInTheDocument();
  });

  it("requests metrics using custom days query parameter when supplied", async () => {
    fetchMock.mockResolvedValue(jsonResponse(SAMPLE_REPOS_PAYLOAD));

    render(<RepoContributionDistribution days={30} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/metrics/repos?days=30");
    });
  });

  it("normalizes alternate payload structures and limits results to top 8 repositories", async () => {
    // Alternate structure using `data` array and string commit counts
    const manyRepos = Array.from({ length: 12 }, (_, i) => ({
      repo: `org/project-${i + 1}`,
      contributions: String(100 - i * 5),
    }));

    fetchMock.mockResolvedValue(jsonResponse({ data: manyRepos }));

    render(<RepoContributionDistribution />);

    await screen.findByRole("heading", {
      level: 2,
      name: "Repository Contribution Distribution",
    });

    // Should limit to 8 repositories
    const repoCards = screen.getAllByText("Repositories");
    expect(repoCards.length).toBeGreaterThan(0);
    expect(screen.getByText("8")).toBeInTheDocument();

    // Top repository should be project-1 (100 commits)
    expect(screen.getAllByTitle("org/project-1").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText("project-1")).toBeInTheDocument();
  });
});
