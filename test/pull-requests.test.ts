import { describe, expect, it } from "vitest";
import {
  legacyPullRequestFields,
  median,
  pullRequestQueries,
  summarizePullRequests,
  weekStart,
  type PullRequestNode,
  type PullRequestRaw,
  type ReviewContributionNode,
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

function review(
  state: string,
  repo: string,
  pullRequest: ReviewContributionNode["pullRequest"] = null
): ReviewContributionNode {
  return {
    pullRequestReview: { state },
    repository: { nameWithOwner: repo },
    pullRequest,
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
          review("APPROVED", "o/x", {
            url: "https://github.com/o/x/pull/1",
            author: { login: "alice" },
          }),
          // A second review on the same PR.
          review("APPROVED", "o/x", {
            url: "https://github.com/o/x/pull/1",
            author: { login: "alice" },
          }),
          review("CHANGES_REQUESTED", "o/y", {
            url: "https://github.com/o/y/pull/9",
            author: { login: "bob" },
          }),
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
      prsReviewed: 2,
      participationRate: 1,
      sampled: false,
      approved: 2,
      changesRequested: 1,
      commented: 0,
      topRepos: [
        { repo: "o/x", count: 2 },
        { repo: "o/y", count: 1 },
      ],
    });
  });

  it("counts each reviewed PR by someone else once", () => {
    const own = {
      url: "https://github.com/me/app/pull/4",
      author: { login: "Me" },
    };
    const alts = {
      url: "https://github.com/me/app/pull/5",
      author: { login: "alt" },
    };
    const theirs = {
      url: "https://github.com/o/x/pull/1",
      author: { login: "alice" },
    };
    const reviews = summarizePullRequests(
      [
        raw({
          inRange: [merged, closed, open],
          reviews: [
            review("COMMENTED", "me/app", own),
            review("APPROVED", "o/x", theirs),
            review("COMMENTED", "o/x", null),
          ],
          reviewsTotal: 3,
        }),
        raw({
          login: "alt",
          reviews: [
            review("COMMENTED", "me/app", alts),
            review("APPROVED", "o/x", { ...theirs }),
          ],
          reviewsTotal: 2,
        }),
      ],
      "30d",
      NOW
    ).reviews;
    expect(reviews).toMatchObject({ total: 5, prsReviewed: 1, sampled: false });
    expect(reviews.participationRate).toBeCloseTo(1 / 3);
  });

  it("counts reviews of a deleted account's PRs", () => {
    const reviews = summarizePullRequests(
      [
        raw({
          inRange: [merged],
          reviews: [
            review("APPROVED", "o/x", {
              url: "https://github.com/o/x/pull/2",
              author: null,
            }),
          ],
          reviewsTotal: 1,
        }),
      ],
      "30d",
      NOW
    ).reviews;
    expect(reviews.prsReviewed).toBe(1);
    expect(reviews.participationRate).toBe(1);
  });

  it("has no participation rate without PRs opened in the range", () => {
    const reviews = summarizePullRequests(
      [
        raw({
          reviews: [
            review("APPROVED", "o/x", {
              url: "https://github.com/o/x/pull/1",
              author: { login: "alice" },
            }),
          ],
          reviewsTotal: 1,
        }),
      ],
      "7d",
      NOW
    ).reviews;
    expect(reviews.prsReviewed).toBe(1);
    expect(reviews.participationRate).toBeNull();
  });

  it("flags a sample when there are more reviews than one request returns", () => {
    const reviews = summarizePullRequests(
      [raw({ reviews: [review("APPROVED", "o/x")], reviewsTotal: 140 })],
      "90d",
      NOW
    ).reviews;
    expect(reviews.sampled).toBe(true);
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
