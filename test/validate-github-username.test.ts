import { describe, it, expect } from "vitest";
import { isValidGitHubUsername, normalizeGitHubUsername } from "../src/lib/validate-github-username";

describe("isValidGitHubUsername", () => {
  it("accepts simple usernames", () => {
    expect(isValidGitHubUsername("octocat")).toBe(true);
  });

  it("accepts usernames with numbers", () => {
    expect(isValidGitHubUsername("user123")).toBe(true);
  });

  it("accepts usernames with hyphens", () => {
    expect(isValidGitHubUsername("my-repo")).toBe(true);
  });

  it("accepts mixed case", () => {
    expect(isValidGitHubUsername("UserName123")).toBe(true);
  });

  it("rejects username starting with hyphen", () => {
    expect(isValidGitHubUsername("-invalid")).toBe(false);
  });

  it("rejects username ending with hyphen", () => {
    expect(isValidGitHubUsername("invalid-")).toBe(false);
  });

  it("rejects username with underscore", () => {
    expect(isValidGitHubUsername("user_name")).toBe(false);
  });

  it("rejects username with space", () => {
    expect(isValidGitHubUsername("user name")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidGitHubUsername("")).toBe(false);
  });

  it("rejects long usernames over 39 chars", () => {
    expect(isValidGitHubUsername("a".repeat(40))).toBe(false);
  });

  it("accepts exactly 39 chars", () => {
    expect(isValidGitHubUsername("a".repeat(39))).toBe(true);
  });

  it("rejects special characters", () => {
    expect(isValidGitHubUsername("user@name")).toBe(false);
    expect(isValidGitHubUsername("user!name")).toBe(false);
    expect(isValidGitHubUsername("user#name")).toBe(false);
  });
});

describe("normalizeGitHubUsername", () => {
  it("returns trimmed username for valid input", () => {
    expect(normalizeGitHubUsername("  octocat  ")).toBe("octocat");
  });

  it("preserves case of valid username", () => {
    expect(normalizeGitHubUsername("UserName")).toBe("UserName");
  });

  it("returns null for null", () => {
    expect(normalizeGitHubUsername(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeGitHubUsername(undefined)).toBeNull();
  });

  it("returns null for non-string", () => {
    expect(normalizeGitHubUsername(123 as any)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeGitHubUsername("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeGitHubUsername("   ")).toBeNull();
  });

  it("returns null for invalid username", () => {
    expect(normalizeGitHubUsername("user name")).toBeNull();
  });

  it("returns null for username starting with hyphen", () => {
    expect(normalizeGitHubUsername("-invalid")).toBeNull();
  });
});
