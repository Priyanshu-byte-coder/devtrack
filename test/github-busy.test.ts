import { describe, expect, it } from "vitest";
import { isGitHubBusyError } from "@/lib/github-busy";
import { GitHubRateLimitError } from "@/lib/github-rate-limit";
import { GuestProfileUnavailableError } from "@/lib/guest-profile";

describe("isGitHubBusyError", () => {
  it("recognises rate limits and the guest budget guard", () => {
    expect(isGitHubBusyError(new GitHubRateLimitError(null))).toBe(true);
    expect(isGitHubBusyError(new GuestProfileUnavailableError())).toBe(true);
  });

  it("leaves other failures alone so they still surface", () => {
    expect(isGitHubBusyError(new Error("boom"))).toBe(false);
    expect(isGitHubBusyError("nope")).toBe(false);
    expect(isGitHubBusyError(undefined)).toBe(false);
  });
});
