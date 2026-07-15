import { describe, it, expect } from "vitest";
import { isValidGitHubUsername } from "@/lib/badge-validation";

describe("isValidGitHubUsername", () => {
  it("accepts valid usernames", () => {
    expect(isValidGitHubUsername("octocat")).toBe(true);
    expect(isValidGitHubUsername("Bhavy12-cell")).toBe(true);
    expect(isValidGitHubUsername("a")).toBe(true);
    expect(isValidGitHubUsername("a-b")).toBe(true);
  });

  it("rejects usernames starting with hyphen", () => {
    expect(isValidGitHubUsername("-octocat")).toBe(false);
  });

  it("rejects usernames ending with hyphen", () => {
    expect(isValidGitHubUsername("octocat-")).toBe(false);
  });

  it("rejects usernames longer than 39 chars", () => {
    expect(isValidGitHubUsername("a".repeat(40))).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidGitHubUsername("")).toBe(false);
  });

  it("rejects XSS payloads", () => {
    expect(isValidGitHubUsername("<script>alert(1)</script>")).toBe(false);
  });

  it("rejects query injection attempts", () => {
    expect(isValidGitHubUsername("octocat+OR+author:admin")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(isValidGitHubUsername("hello world")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(isValidGitHubUsername("user@name")).toBe(false);
    expect(isValidGitHubUsername("user/name")).toBe(false);
  });
});