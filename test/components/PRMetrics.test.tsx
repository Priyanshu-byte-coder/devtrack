import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PRMetrics from "../../src/components/PRMetrics";
import type { PullRequestSummary } from "../../src/lib/pull-requests";

function summary(
  reviews: Partial<PullRequestSummary["reviews"]> = {}
): PullRequestSummary {
  return {
    range: "30d",
    opened: 4,
    merged: 3,
    closed: 1,
    stillOpen: 0,
    mergeRate: 0.75,
    medianHoursToMerge: 5,
    medianHoursToFirstReview: 2,
    additions: 420,
    deletions: 96,
    sampled: false,
    openNow: 0,
    draftsNow: 0,
    weeks: [{ weekStart: "2026-11-02", opened: 4, merged: 3 }],
    repos: [{ repo: "demo/repo", opened: 4, merged: 3 }],
    openList: [],
    recentMerged: [],
    reviews: {
      total: 9,
      prsReviewed: 6,
      participationRate: 1.5,
      sampled: false,
      approved: 5,
      changesRequested: 1,
      commented: 3,
      topRepos: [{ repo: "o/x", count: 9 }],
      ...reviews,
    },
  };
}

function reply(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

describe("PRMetrics review participation", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows PRs reviewed and the participation ratio", async () => {
    fetchMock.mockReturnValue(reply({ summary: summary() }));
    render(<PRMetrics />);

    const reviewed = await screen.findByTitle(
      "PRs where you left a review comment or approval"
    );
    expect(within(reviewed).getByText("6")).toBeInTheDocument();
    expect(within(reviewed).getByText("PRs reviewed")).toBeInTheDocument();
    const ratio = screen
      .getByText(/^PRs reviewed for every PR you opened\.$/)
      .closest("p");
    expect(ratio).toHaveTextContent(
      "1.5 PRs reviewed for every PR you opened."
    );
    expect(ratio).not.toHaveTextContent("%");
  });

  it("shows a ratio below one", async () => {
    fetchMock.mockReturnValue(
      reply({
        summary: summary({ total: 3, prsReviewed: 2, participationRate: 0.5 }),
      })
    );
    render(<PRMetrics />);

    const ratio = (
      await screen.findByText(/^PRs reviewed for every PR you opened\.$/)
    ).closest("p");
    expect(ratio).toHaveTextContent(
      "0.5 PRs reviewed for every PR you opened."
    );
  });

  it("uses the singular for a ratio of exactly one", async () => {
    fetchMock.mockReturnValue(
      reply({
        summary: summary({ total: 5, prsReviewed: 4, participationRate: 1 }),
      })
    );
    render(<PRMetrics />);

    const ratio = (
      await screen.findByText(/^PR reviewed for every PR you opened\.$/)
    ).closest("p");
    expect(ratio).toHaveTextContent("1 PR reviewed for every PR you opened.");
  });

  it("keeps a small ratio above zero", async () => {
    fetchMock.mockReturnValue(
      reply({
        summary: {
          ...summary({
            total: 1,
            prsReviewed: 1,
            participationRate: 1 / 30,
          }),
          opened: 30,
        },
      })
    );
    render(<PRMetrics />);

    const ratio = (
      await screen.findByText(/^PRs reviewed for every PR you opened\.$/)
    ).closest("p");
    expect(ratio).toHaveTextContent(
      "0.03 PRs reviewed for every PR you opened."
    );
  });

  it("marks a sampled count as a lower bound", async () => {
    fetchMock.mockReturnValue(
      reply({
        summary: summary({ total: 140, prsReviewed: 80, sampled: true }),
      })
    );
    render(<PRMetrics />);

    expect(await screen.findByText("80+")).toBeInTheDocument();
    expect(
      screen.getByText(
        /^PRs reviewed for every PR you opened \(latest 100 reviews\)\.$/
      )
    ).toBeInTheDocument();
  });

  it("explains the missing rate when no PRs were opened", async () => {
    fetchMock.mockReturnValue(
      reply({
        summary: {
          ...summary({ participationRate: null }),
          opened: 0,
          merged: 0,
          closed: 0,
          mergeRate: null,
          repos: [],
        },
      })
    );
    render(<PRMetrics />);

    expect(
      await screen.findByText(
        "Open a PR in this range to compare reviews given with PRs opened."
      )
    ).toBeInTheDocument();
  });
});
