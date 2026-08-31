/**
 * Regression tests for goals sync repo query injection (#1757).
 *
 * Background
 * ----------
 * The goals sync route read an optional repo field from stored goal rows and
 * interpolated it directly into GitHub Search API queries:
 *
 *   const repoQualifier = repo ? `+repo:${repo}` : "";
 *   fetch(`…/search/commits?q=author:${login}${repoQualifier}+author-date:…`)
 *
 * A stored value containing GitHub search operators — such as
 * "octocat/Hello-World+author:victim" — would expand the search scope
 * beyond the authenticated user's commits without any indication to the user.
 *
 * Fix
 * ---
 * extractValidRepoFromGoal() validates the raw field value against a strict
 * "owner/repo" regex before it is used. Any value that does not match is
 * treated as absent (null). Query construction was also moved to
 * URLSearchParams so that the combined qualifier string is encoded as a
 * single atomic value.
 */

import { describe, it, expect } from "vitest";
import { extractValidRepoFromGoal } from "@/lib/goals-sync-utils";

// Re-use the ActivityGoal shape from the route (struct duck-typed here).
type GoalLike = {
  id: string;
  unit: string;
  repo: string | null;
  repository: string | null;
  repo_name: string | null;
};

function makeGoal(overrides: Partial<GoalLike> = {}): GoalLike {
  return {
    id: "goal-1",
    unit: "commits",
    repo: null,
    repository: null,
    repo_name: null,
    ...overrides,
  };
}

describe("extractValidRepoFromGoal — repo field validation", () => {
  // ── valid values ──────────────────────────────────────────────────────────

  it("accepts a standard owner/repo from the repo field", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "octocat/Hello-World" }))).toBe(
      "octocat/Hello-World"
    );
  });

  it("accepts owner/repo from the repository field when repo is null", () => {
    expect(
      extractValidRepoFromGoal(makeGoal({ repo: null, repository: "torvalds/linux" }))
    ).toBe("torvalds/linux");
  });

  it("accepts owner/repo from repo_name when repo and repository are null", () => {
    expect(
      extractValidRepoFromGoal(makeGoal({ repo: null, repository: null, repo_name: "alice/my-project" }))
    ).toBe("alice/my-project");
  });

  it("trims surrounding whitespace from the stored value", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "  octocat/Hello-World  " }))).toBe(
      "octocat/Hello-World"
    );
  });

  it("accepts a repo name with dots and underscores", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "user/my.project_v2" }))).toBe(
      "user/my.project_v2"
    );
  });

  it("accepts an org name with hyphens", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "my-org/my-repo" }))).toBe(
      "my-org/my-repo"
    );
  });

  // ── null / empty — no repo filter ─────────────────────────────────────────

  it("returns null when all repo fields are null", () => {
    expect(extractValidRepoFromGoal(makeGoal())).toBeNull();
  });

  it("returns null for an empty string value", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "" }))).toBeNull();
  });

  it("returns null for a whitespace-only value", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "   " }))).toBeNull();
  });

  // ── query injection attempts — regression for #1757 ──────────────────────

  it("rejects a repo value with an embedded +author: qualifier — regression for #1757", () => {
    expect(
      extractValidRepoFromGoal(makeGoal({ repo: "octocat/Hello-World+author:victim" }))
    ).toBeNull();
  });

  it("rejects a repo value with a space-separated qualifier", () => {
    expect(
      extractValidRepoFromGoal(makeGoal({ repo: "octocat/Hello-World author:victim" }))
    ).toBeNull();
  });

  it("rejects a repo value with an ampersand operator", () => {
    expect(
      extractValidRepoFromGoal(makeGoal({ repo: "octocat/Hello-World&language:TypeScript" }))
    ).toBeNull();
  });

  it("rejects a URL-encoded plus sign that would expand on decode", () => {
    // After URL encoding, %2B decodes to +; the raw stored value must also be rejected.
    expect(
      extractValidRepoFromGoal(makeGoal({ repo: "octocat/Hello-World%2Bauthor:victim" }))
    ).toBeNull();
  });

  // ── extra path segments ───────────────────────────────────────────────────

  it("rejects a three-segment path", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "octocat/Hello-World/issues" }))).toBeNull();
  });

  it("rejects a four-segment path", () => {
    expect(
      extractValidRepoFromGoal(makeGoal({ repo: "octocat/Hello-World/issues/123" }))
    ).toBeNull();
  });

  // ── path traversal ────────────────────────────────────────────────────────

  it("rejects owner/../attack as a repo name", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "owner/.." }))).toBeNull();
  });

  it("rejects owner/. as a repo name", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "owner/." }))).toBeNull();
  });

  // ── invalid formats ───────────────────────────────────────────────────────

  it("rejects a bare name without an owner", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "just-repo-name" }))).toBeNull();
  });

  it("rejects a leading slash", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "/Hello-World" }))).toBeNull();
  });

  it("rejects a trailing slash", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "octocat/" }))).toBeNull();
  });

  it("rejects an owner starting with a hyphen", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "-bad/repo" }))).toBeNull();
  });

  it("rejects an owner ending with a hyphen", () => {
    expect(extractValidRepoFromGoal(makeGoal({ repo: "bad-/repo" }))).toBeNull();
  });

  it("rejects an owner longer than 39 chars", () => {
    const longOwner = "a".repeat(40);
    expect(extractValidRepoFromGoal(makeGoal({ repo: `${longOwner}/repo` }))).toBeNull();
  });

  it("rejects a repo name longer than 100 chars", () => {
    const longRepo = "r".repeat(101);
    expect(extractValidRepoFromGoal(makeGoal({ repo: `owner/${longRepo}` }))).toBeNull();
  });

  // ── field priority ────────────────────────────────────────────────────────

  it("uses repo over repository when both are present", () => {
    const result = extractValidRepoFromGoal(
      makeGoal({ repo: "alice/first", repository: "alice/second" })
    );
    expect(result).toBe("alice/first");
  });

  it("uses repository over repo_name when repo is null", () => {
    const result = extractValidRepoFromGoal(
      makeGoal({ repo: null, repository: "alice/second", repo_name: "alice/third" })
    );
    expect(result).toBe("alice/second");
  });

  it("falls through to repo_name when repo and repository are null", () => {
    const result = extractValidRepoFromGoal(
      makeGoal({ repo: null, repository: null, repo_name: "alice/third" })
    );
    expect(result).toBe("alice/third");
  });

  it("falls through to the next field when a higher-priority field is invalid", () => {
    // repo is present but invalid; repository is valid — the result should be null
    // because the function uses the first non-empty raw value, which in this case
    // is the invalid repo. The fallback only applies when earlier fields are null.
    const result = extractValidRepoFromGoal(
      makeGoal({ repo: "bad value with spaces", repository: "alice/good" })
    );
    // The first non-null field ("bad value with spaces") is read and fails validation;
    // we do NOT fall through to repository. This is intentional: it prevents a stored
    // invalid value from silently being replaced by a different field.
    expect(result).toBeNull();
  });
});
