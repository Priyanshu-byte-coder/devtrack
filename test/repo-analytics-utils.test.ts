import { describe, it, expect } from "vitest";
import { parseRepoParam } from "@/lib/repo-analytics-utils";

describe("parseRepoParam", () => {
  describe("valid inputs", () => {
    it("parses a simple owner/repo", () => {
      expect(parseRepoParam("facebook/react")).toEqual({
        owner: "facebook",
        repo: "react",
      });
    });

    it("parses owner and repo with hyphens", () => {
      expect(parseRepoParam("my-org/my-repo-name")).toEqual({
        owner: "my-org",
        repo: "my-repo-name",
      });
    });

    it("parses owner with numbers", () => {
      expect(parseRepoParam("user123/project456")).toEqual({
        owner: "user123",
        repo: "project456",
      });
    });

    it("parses repo with dots and underscores", () => {
      expect(parseRepoParam("owner/repo.name_v2")).toEqual({
        owner: "owner",
        repo: "repo.name_v2",
      });
    });

    it("parses owner at max length (39 chars)", () => {
      const owner = "a".repeat(39);
      expect(parseRepoParam(`${owner}/repo`)).toEqual({
        owner,
        repo: "repo",
      });
    });

    it("trims whitespace", () => {
      expect(parseRepoParam("  owner/repo  ")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses owner starting with hyphen is invalid", () => {
      expect(parseRepoParam("-owner/repo")).toBeNull();
    });

    it("parses owner ending with hyphen is invalid", () => {
      expect(parseRepoParam("owner-/repo")).toBeNull();
    });
  });

  describe("invalid inputs", () => {
    it("returns null for empty string", () => {
      expect(parseRepoParam("")).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      expect(parseRepoParam("   ")).toBeNull();
    });

    it("returns null for no slash", () => {
      expect(parseRepoParam("owner-repo")).toBeNull();
    });

    it("returns null for extra slashes", () => {
      expect(parseRepoParam("owner/repo/extra")).toBeNull();
    });

    it("returns null for owner too long (>39 chars)", () => {
      const longOwner = "a".repeat(40);
      expect(parseRepoParam(`${longOwner}/repo`)).toBeNull();
    });

    it("returns null for repo too long (>100 chars)", () => {
      const longRepo = "r".repeat(101);
      expect(parseRepoParam(`owner/${longRepo}`)).toBeNull();
    });

    it("returns null for dot-only repo name", () => {
      expect(parseRepoParam("owner/.")).toBeNull();
    });

    it("returns null for dot-dot repo name", () => {
      expect(parseRepoParam("owner/..")).toBeNull();
    });

    it("returns null for invalid characters in owner", () => {
      expect(parseRepoParam("owner!#$/repo")).toBeNull();
    });

    it("returns null for invalid characters in repo", () => {
      expect(parseRepoParam("owner/repo@#$")).toBeNull();
    });

    it("returns null for spaces around slash", () => {
      expect(parseRepoParam("owner / repo")).toBeNull();
    });
  });
});
