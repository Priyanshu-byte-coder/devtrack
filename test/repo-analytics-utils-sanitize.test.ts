import { describe, it, expect } from "vitest";
import { parseRepoParam } from "@/lib/repo-analytics-utils";

describe("parseRepoParam — input sanitisation", () => {
  it("strips a single leading slash before validating", () => {
    expect(parseRepoParam("/owner/repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("collapses consecutive slashes before validating", () => {
    expect(parseRepoParam("owner//repo")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("handles mixed leading slash, double slashes, and surrounding spaces", () => {
    expect(parseRepoParam("  /owner//repo  ")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("leaves normal input unchanged", () => {
    expect(parseRepoParam("facebook/react")).toEqual({
      owner: "facebook",
      repo: "react",
    });
  });
});
