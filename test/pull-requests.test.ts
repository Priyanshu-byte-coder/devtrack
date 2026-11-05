import { describe, expect, it } from "vitest";
import {
  legacyPullRequestFields,
  median,
  pullRequestQueries,
  summarizePullRequests,
  weekStart,
  type PullRequestNode,
  type PullRequestRaw,
} from "@/lib/pull-requests";

const NOW = new Date("2026-11-05T12:00:00Z");

function pr(
  n: number,
  overrides: Partial<PullRequestNode> & { reviewer?: [string, string] } = {}
): PullRequestNode {
  const { reviewer, ...rest } = overrides;
  return {
    number: n,
    title: `PR ${n}`,
    url: `https://github.com/me/app/pull/${n}`,
    state: "OPEN",
    isDraft: false,
    createdAt: "2026-11-02T10:00:00Z",
    mergedAt: null,
    closedAt: null,
    additions: 10,
    deletions: 2,
    repository: { nameWithOwner: "me/app" },
    reviews: {
      nodes: reviewer
        ? [{ author: { login: reviewer[0] }, submittedAt: reviewer[1] }]
        : [],
    },
    ...rest,
  };
}

function raw(partial: Partial<PullRequestRaw>): PullRequestRaw {
  return {
    login: "me",
    inRange: [],
    inRangeTotal: 0,
    openNow: [],
    openTotal: 0,
    reviews: [],
    reviewsTotal: 0,
    ...partial,
  };
}

describe("summarizePullRequests", () => {
  const merged = pr(1, {
    state: "MERGED",
    createdAt: "2026-10-20T00:00:00Z",
    mergedAt: "2026-10-21T00:00:00Z",
    closedAt: "2026-10-21T00:00:00Z",
    reviewer: ["alice", "2026-10-20T06:00:00Z"],
  });
  const closed = pr(2, {
    state: "CLOSED",
    createdAt: "2026-10-27T00:00:00Z",
    closedAt: "2026-10-28T00:00:00Z",
    repository: { nameWithOwner: "me/lib" },
  });
  const open = pr(3, {
    createdAt: "2026-10-01T00:00:00Z",
    isDraft: true,
    // The author's own review doesn't count as a first review.
    reviewer: ["me", "2026-10-01T01:00:00Z"],
  });

  const summary = summarizePullRequests(
    [
      raw({
        inRange: [merged, closed],
        inRangeTotal: 2,
        openNow: [open],
        openTotal: 1,
        reviews: [
          {
            pullRequestReview: { state: "APPROVED" },
            repository: { nameWithOwner: "o/x" },
          },
          {
            pullRequestReview: { state: "APPROVED" },
            repository: { nameWithOwner: "o/x" },
          },
          {
            pullRequestReview: { state: "CHANGES_REQUESTED" },
            repository: { nameWithOwner: "o/y" },
          },
        ],
        reviewsTotal: 3,
      }),
    ],
    "30d",
    NOW
  );

  it("counts outcomes for PRs opened in the range", () => {
    expect(summary).toMatchObject({
      opened: 2,
      merged: 1,
      closed: 1,
      mergeRate: 0.5,
      additions: 20,
      deletions: 4,
      openNow: 1,
      draftsNow: 1,
      sampled: false,
    });
  });

  it("measures merge time and first review by someone else", () => {
    expect(summary.medianHoursToMerge).toBe(24);
    expect(summary.medianHoursToFirstReview).toBe(6);
    expect(summary.openList[0]).toMatchObject({
      number: 3,
      ageDays: 35,
      isDraft: true,
      reviewed: false,
    });
  });

  it("lists every calendar week in the range, oldest first", () => {
    const starts = summary.weeks.map((w) => w.weekStart);
    expect(starts).toEqual([...starts].sort());
    expect(starts.at(-1)).toBe("2026-11-02");
    expect(summary.weeks.find((w) => w.weekStart === "2026-10-19")).toEqual({
      weekStart: "2026-10-19",
      opened: 1,
      merged: 1,
    });
  });

  it("summarises reviews given", () => {
    expect(summary.reviews).toEqual({
      total: 3,
      approved: 2,
      changesRequested: 1,
      commented: 0,
      topRepos: [
        { repo: "o/x", count: 2 },
        { repo: "o/y", count: 1 },
      ],
    });
  });

  it("keeps the fields other features read", () => {
    expect(legacyPullRequestFields(summary)).toMatchObject({
      open: 1,
      merged: 1,
      total: 2,
      avgReviewHours: 24,
      avgFirstReviewHours: 6,
      mergeRate: "50%",
    });
  });

  it("flags a sample when GitHub has more PRs than one request returns", () => {
    expect(
      summarizePullRequests(
        [raw({ inRange: [merged], inRangeTotal: 250 })],
        "90d",
        NOW
      ).sampled
    ).toBe(true);
  });

  it("dedupes PRs seen through several linked accounts", () => {
    const both = summarizePullRequests(
      [
        raw({ inRange: [merged] }),
        raw({ login: "alt", inRange: [{ ...merged }] }),
      ],
      "30d",
      NOW
    );
    expect(both.opened).toBe(1);
  });
});

describe("helpers", () => {
  it("finds the Monday of a week in UTC", () => {
    expect(weekStart(new Date("2026-11-08T23:00:00Z")).toISOString()).toBe(
      "2026-11-02T00:00:00.000Z"
    );
  });

  it("takes the median of odd and even lists", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("scopes both searches to an org or away from excluded ones", () => {
    expect(pullRequestQueries("me", "2026-10-01", { org: "acme" }).open).toBe(
      "is:pr author:me is:open org:acme sort:created-asc"
    );
    expect(
      pullRequestQueries("me", "2026-10-01", { excludedOrgs: ["a", "b"] })
        .inRange
    ).toBe(
      "is:pr author:me created:>=2026-10-01 -org:a -org:b sort:created-desc"
    );
  });
});
