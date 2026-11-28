import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountContext } from "@/components/AccountContext";
import InactiveRepositoriesCard from "@/components/InactiveRepositoriesCard";
import type { InactiveRepo } from "@/types/inactive-repos";

function response(status: number, body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  );
}

function renderCard(selectedAccount: string | null = null) {
  return render(
    <AccountContext.Provider
      value={{ selectedAccount, setSelectedAccount: vi.fn() }}
    >
      <InactiveRepositoriesCard />
    </AccountContext.Provider>
  );
}

const inactiveRepos: InactiveRepo[] = [
  {
    name: "octocat/legacy-dashboard",
    lastActiveAt: "2026-10-01T00:00:00.000Z",
    inactiveDays: 61,
    visibility: "private",
    url: "https://github.com/octocat/legacy-dashboard",
  },
  {
    name: "octocat/internal-tools",
    lastActiveAt: "not-a-date",
    inactiveDays: 92,
    visibility: "internal",
    url: "https://github.com/octocat/internal-tools",
  },
  {
    name: "octocat/old-docs",
    lastActiveAt: "2026-11-01T00:00:00.000Z",
    inactiveDays: 30,
    visibility: "public",
    url: "https://github.com/octocat/old-docs",
  },
];

describe("InactiveRepositoriesCard", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the loading state while the request is pending", async () => {
    let resolveRequest!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      })
    );

    renderCard();

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByText("Loading inactive repositories")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh inactive repositories" })
    ).toBeDisabled();

    await act(async () => {
      resolveRequest(
        new Response(JSON.stringify({ repos: [inactiveRepos[0]] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
    });

    expect(
      await screen.findByRole("link", { name: /octocat\/legacy-dashboard/ })
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows an error and retries when the API responds unsuccessfully", async () => {
    fetchMock
      .mockReturnValueOnce(response(500, { error: "Server error" }))
      .mockReturnValueOnce(response(200, { repos: [inactiveRepos[0]] }));

    renderCard();

    expect(
      await screen.findByText(
        "We couldn't load inactive repositories right now. Please try again in a moment."
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("link", { name: /octocat\/legacy-dashboard/ })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the error state when the request rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network unavailable"));

    renderCard();

    expect(
      await screen.findByText(
        "We couldn't load inactive repositories right now. Please try again in a moment."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument();
  });

  it("shows the empty state when the API returns no repositories", async () => {
    fetchMock.mockReturnValue(response(200, { repos: [] }));

    renderCard();

    expect(
      await screen.findByText(
        "Nice! No inactive repositories for this period."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders repository details and GitHub links from the API response", async () => {
    fetchMock.mockReturnValue(response(200, { repos: inactiveRepos }));

    renderCard();

    const legacyRepo = await screen.findByRole("link", {
      name: /octocat\/legacy-dashboard/,
    });
    expect(legacyRepo).toHaveAttribute(
      "href",
      "https://github.com/octocat/legacy-dashboard"
    );
    expect(legacyRepo).toHaveAttribute("target", "_blank");
    expect(legacyRepo).toHaveAttribute("rel", "noopener noreferrer");
    expect(legacyRepo).toHaveTextContent("private");
    expect(legacyRepo).toHaveTextContent("Oct 1, 2026");
    expect(legacyRepo).toHaveTextContent("61 inactive days");

    const internalRepo = screen.getByRole("link", {
      name: /octocat\/internal-tools/,
    });
    expect(internalRepo).toHaveTextContent("internal");
    expect(internalRepo).toHaveTextContent("Unknown date");
    expect(internalRepo).toHaveTextContent("92 inactive days");

    const publicRepo = screen.getByRole("link", {
      name: /octocat\/old-docs/,
    });
    expect(publicRepo).toHaveTextContent("public");
    expect(publicRepo).toHaveTextContent("Open on GitHub");
  });

  it("refetches with the selected inactivity threshold and account", async () => {
    fetchMock.mockReturnValue(response(200, { repos: [] }));

    renderCard("org/work account");

    expect(
      await screen.findByText(
        "Nice! No inactive repositories for this period."
      )
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/metrics/inactive-repos?days=30&accountId=org%2Fwork%20account"
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Select inactivity threshold" }),
      { target: { value: "60" } }
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/metrics/inactive-repos?days=60&accountId=org%2Fwork%20account"
      );
    });
  });

  it("refreshes the list when the user clicks Refresh", async () => {
    fetchMock
      .mockReturnValueOnce(response(200, { repos: [inactiveRepos[0]] }))
      .mockReturnValueOnce(response(200, { repos: [inactiveRepos[2]] }));

    renderCard();

    expect(
      await screen.findByRole("link", { name: /octocat\/legacy-dashboard/ })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh inactive repositories" })
    );

    expect(
      await screen.findByRole("link", { name: /octocat\/old-docs/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /octocat\/legacy-dashboard/ })
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
