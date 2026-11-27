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
import TopRepos from "@/components/TopRepos";

function reply(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

const mockRepos = [
  {
    name: "owner/alpha-repo",
    commits: 40,
    url: "https://github.com/owner/alpha-repo",
    description: "Alpha repo description",
    languages: [
      { name: "TypeScript", bytes: 12000, percentage: 75 },
      { name: "JavaScript", bytes: 4000, percentage: 25 },
    ],
  },
  {
    name: "owner/beta-repo",
    commits: 20,
    url: "https://github.com/owner/beta-repo",
    description: "Beta repo description",
    languages: [{ name: "Python", bytes: 8000, percentage: 100 }],
  },
  {
    name: "owner/gamma-repo",
    commits: 10,
    url: "https://github.com/owner/gamma-repo",
    description: "Gamma repo description",
    languages: [],
  },
];

const mockHealth = {
  repos: [
    {
      repo: "owner/alpha-repo",
      score: 88,
      grade: "green" as const,
      signals: {
        commitFrequency: 14,
        prMergeRate: 0.85,
        avgPrOpenTimeHours: 18,
        openIssuesCount: 1,
        daysSinceLastCommit: 2,
      },
    },
    {
      repo: "owner/beta-repo",
      score: 65,
      grade: "yellow" as const,
      signals: {
        commitFrequency: 8,
        prMergeRate: 0.6,
        avgPrOpenTimeHours: 36,
        openIssuesCount: 4,
        daysSinceLastCommit: 5,
      },
    },
  ],
};

describe("TopRepos", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi
      .fn()
      .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";

        if (url.includes("/api/user/settings") && method === "GET") {
          return reply(200, { pinned_repos: [] });
        }
        if (url.includes("/api/user/settings") && method === "PATCH") {
          return reply(200, { success: true });
        }
        if (url.includes("/api/metrics/repos")) {
          return reply(200, { repos: mockRepos });
        }
        if (url.includes("/api/metrics/repo-health")) {
          return reply(200, mockHealth);
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

  it("renders heading and loading state until repository request resolves", async () => {
    let resolveReposPromise: (value: Response) => void;
    const pendingRepos = new Promise<Response>((resolve) => {
      resolveReposPromise = resolve;
    });

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/user/settings")) {
        return reply(200, { pinned_repos: [] });
      }
      if (url.includes("/api/metrics/repos")) {
        return pendingRepos;
      }
      if (url.includes("/api/metrics/repo-health")) {
        return reply(200, mockHealth);
      }
      return reply(404, {});
    });

    render(<TopRepos />);

    expect(
      screen.getByRole("heading", { name: /Top Repositories/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("alpha-repo")).not.toBeInTheDocument();

    resolveReposPromise!(
      new Response(JSON.stringify({ repos: mockRepos }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("handles repository endpoint failure with error message and retry action", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/repos")) {
        return Promise.reject(new Error("Network failed"));
      }
      if (url.includes("/api/user/settings")) {
        return reply(200, { pinned_repos: [] });
      }
      if (url.includes("/api/metrics/repo-health")) {
        return reply(200, { repos: [] });
      }
      return reply(404, {});
    });

    render(<TopRepos />);

    expect(
      await screen.findByText(
        "We couldn't load your top repositories right now. Please try again in a moment."
      )
    ).toBeInTheDocument();

    const tryAgainBtn = screen.getByRole("button", { name: "Try again" });
    expect(tryAgainBtn).toBeInTheDocument();

    // Reset fetchMock to return success and click try again
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/repos")) {
        return reply(200, { repos: mockRepos });
      }
      if (url.includes("/api/user/settings")) {
        return reply(200, { pinned_repos: [] });
      }
      if (url.includes("/api/metrics/repo-health")) {
        return reply(200, mockHealth);
      }
      return reply(404, {});
    });

    fireEvent.click(tryAgainBtn);

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();
  });

  it("keeps repository list usable when repo-health endpoint rejects", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/repo-health")) {
        return Promise.reject(new Error("Health calculation timeout"));
      }
      if (url.includes("/api/metrics/repos")) {
        return reply(200, { repos: mockRepos });
      }
      if (url.includes("/api/user/settings")) {
        return reply(200, { pinned_repos: [] });
      }
      return reply(404, {});
    });

    render(<TopRepos />);

    // Repositories render successfully
    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();
    expect(screen.getByText("beta-repo")).toBeInTheDocument();

    // Health badges display fallback "--" with insufficient data title
    const fallbacks = screen.getAllByTitle(
      "Not enough data to calculate health score"
    );
    expect(fallbacks.length).toBeGreaterThan(0);
    expect(fallbacks[0]).toHaveTextContent("--");
  });

  it("continues rendering repositories when user settings request rejects", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/user/settings")) {
        return Promise.reject(new Error("Settings load error"));
      }
      if (url.includes("/api/metrics/repos")) {
        return reply(200, { repos: mockRepos });
      }
      if (url.includes("/api/metrics/repo-health")) {
        return reply(200, mockHealth);
      }
      return reply(404, {});
    });

    render(<TopRepos />);

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();
    expect(
      screen.queryByText(/We couldn't load your top repositories/i)
    ).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it("displays explicit empty state when repos array is empty", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/metrics/repos")) {
        return reply(200, { repos: [] });
      }
      if (url.includes("/api/user/settings")) {
        return reply(200, { pinned_repos: [] });
      }
      if (url.includes("/api/metrics/repo-health")) {
        return reply(200, { repos: [] });
      }
      return reply(404, {});
    });

    render(<TopRepos />);

    expect(
      await screen.findByText("No repositories found")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Push your first commit on GitHub to get started and see repository activity here."
      )
    ).toBeInTheDocument();

    const createRepoLink = screen.getByRole("link", {
      name: "Create Repository",
    });
    expect(createRepoLink).toHaveAttribute("href", "https://github.com/new");
  });

  it("renders realistic repository details, languages, and health scores", async () => {
    render(<TopRepos />);

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();
    expect(screen.getByText("beta-repo")).toBeInTheDocument();
    expect(screen.getByText("gamma-repo")).toBeInTheDocument();

    expect(screen.getByText("40 commits")).toBeInTheDocument();
    expect(screen.getByText("20 commits")).toBeInTheDocument();
    expect(screen.getByText("10 commits")).toBeInTheDocument();

    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();

    // Health score buttons for repos with health data
    expect(
      screen.getByRole("button", {
        name: "View health breakdown for alpha-repo",
      })
    ).toHaveTextContent("88");
    expect(
      screen.getByRole("button", {
        name: "View health breakdown for beta-repo",
      })
    ).toHaveTextContent("65");
  });

  it("filters repository list by search query and supports clearing search", async () => {
    render(<TopRepos />);

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search repositories by name");
    fireEvent.change(searchInput, { target: { value: "beta" } });

    expect(screen.queryByText("alpha-repo")).not.toBeInTheDocument();
    expect(screen.getByText("beta-repo")).toBeInTheDocument();
    expect(screen.queryByText("gamma-repo")).not.toBeInTheDocument();

    // Non-matching query
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    expect(screen.getByText("No repos match your search.")).toBeInTheDocument();

    // Clear search button
    const clearBtn = screen.getByRole("button", { name: "Clear search" });
    fireEvent.click(clearBtn);

    expect(screen.getByText("alpha-repo")).toBeInTheDocument();
    expect(screen.getByText("beta-repo")).toBeInTheDocument();
    expect(screen.getByText("gamma-repo")).toBeInTheDocument();
  });

  it("sorts repositories by name and commit count with direction toggle", async () => {
    render(<TopRepos />);

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();

    const sortByNameBtn = screen.getByRole("button", {
      name: "Sort by repository name",
    });
    const sortByCommitsBtn = screen.getByRole("button", {
      name: "Sort by commit count",
    });

    // Click sort by name -> desc order (gamma, beta, alpha)
    fireEvent.click(sortByNameBtn);
    let items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("gamma-repo");

    // Click sort by name again -> asc order (alpha, beta, gamma)
    fireEvent.click(sortByNameBtn);
    items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("alpha-repo");

    // Click sort by commits -> desc order (alpha=40, beta=20, gamma=10)
    fireEvent.click(sortByCommitsBtn);
    items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("alpha-repo");
  });

  it("handles bookmarking repositories and switching to Saved Projects tab", async () => {
    render(<TopRepos />);

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();

    const bookmarkAlpha = screen.getByRole("button", {
      name: "Bookmark owner/alpha-repo",
    });
    fireEvent.click(bookmarkAlpha);

    expect(
      screen.getByRole("button", {
        name: "Remove owner/alpha-repo from bookmarks",
      })
    ).toBeInTheDocument();

    const savedTab = screen.getByRole("button", { name: /Saved Projects/i });
    fireEvent.click(savedTab);

    // Only alpha-repo should be visible in Saved Projects tab
    expect(screen.getByText("alpha-repo")).toBeInTheDocument();
    expect(screen.queryByText("beta-repo")).not.toBeInTheDocument();
    expect(screen.queryByText("gamma-repo")).not.toBeInTheDocument();

    // Un-bookmark
    const removeAlpha = screen.getByRole("button", {
      name: "Remove owner/alpha-repo from bookmarks",
    });
    fireEvent.click(removeAlpha);

    expect(screen.queryByText("alpha-repo")).not.toBeInTheDocument();
  });

  it("handles pin/unpin interaction with PATCH request and enforces 3-pin limit", async () => {
    const reposWithFour = [
      ...mockRepos,
      {
        name: "owner/delta-repo",
        commits: 5,
        url: "https://github.com/owner/delta-repo",
        description: null,
      },
    ];

    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        if (url.includes("/api/user/settings") && method === "GET") {
          return reply(200, {
            pinned_repos: [
              "owner/alpha-repo",
              "owner/beta-repo",
              "owner/gamma-repo",
            ],
          });
        }
        if (url.includes("/api/user/settings") && method === "PATCH") {
          return reply(200, { success: true });
        }
        if (url.includes("/api/metrics/repos")) {
          return reply(200, { repos: reposWithFour });
        }
        if (url.includes("/api/metrics/repo-health")) {
          return reply(200, { repos: [] });
        }
        return reply(404, {});
      }
    );

    render(<TopRepos />);

    expect(await screen.findByText("delta-repo")).toBeInTheDocument();

    // With 3 already pinned, attempting to pin a 4th should show error
    const pinDelta = screen.getByRole("button", {
      name: "Pin owner/delta-repo",
    });
    fireEvent.click(pinDelta);

    expect(screen.getByText("Maximum 3 pins allowed")).toBeInTheDocument();

    // Unpin alpha-repo
    const unpinAlpha = screen.getByRole("button", {
      name: "Unpin owner/alpha-repo",
    });
    fireEvent.click(unpinAlpha);

    const patchCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        typeof url === "string" &&
        url.includes("/api/user/settings") &&
        init?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    const patchBody = JSON.parse(patchCall![1].body as string);
    expect(patchBody.pinned_repos).not.toContain("owner/alpha-repo");
  });

  it("triggers new requests when range selector is changed", async () => {
    render(<TopRepos />);

    expect(await screen.findByText("alpha-repo")).toBeInTheDocument();

    const rangeSelect = screen.getByLabelText(
      "Select time range for top repositories"
    );
    fireEvent.change(rangeSelect, { target: { value: "90" } });

    await waitFor(() => {
      const calls90 = fetchMock.mock.calls.filter(
        ([url]) => typeof url === "string" && url.includes("days=90")
      );
      expect(calls90.length).toBeGreaterThan(0);
    });
  });
});
