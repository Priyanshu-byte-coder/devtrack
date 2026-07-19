import { describe, it, expect } from "vitest";
import { cleanUsername, formatRepositoryName } from "@/lib/string-utils";

describe("string-utils", () => {
  describe("cleanUsername", () => {
    it("returns trimmed lowercase string for normal input", () => {
      expect(cleanUsername("someUser")).toBe("someuser");
    });

    it("handles leading whitespace", () => {
      expect(cleanUsername("  alice")).toBe("alice");
    });

    it("handles trailing whitespace", () => {
      expect(cleanUsername("bob  ")).toBe("bob");
    });

    it("handles leading and trailing whitespace", () => {
      expect(cleanUsername("  charlie  ")).toBe("charlie");
    });

    it("handles all-uppercase username", () => {
      expect(cleanUsername("ALICE")).toBe("alice");
    });

    it("handles mixed-case username", () => {
      expect(cleanUsername("BobSmith")).toBe("bobsmith");
    });

    it("handles username with spaces", () => {
      expect(cleanUsername("  Alice Bob  ")).toBe("alice bob");
    });

    it("returns empty string for input that trims to empty", () => {
      expect(cleanUsername("   ")).toBe("");
    });

    it("preserves numbers in username", () => {
      expect(cleanUsername("User123")).toBe("user123");
    });

    it("handles hyphens and underscores", () => {
      expect(cleanUsername("Bob-Smith_42")).toBe("bob-smith_42");
    });
  });

  describe("formatRepositoryName", () => {
    it("returns trimmed lowercase string for normal input", () => {
      expect(formatRepositoryName("MyRepo")).toBe("myrepo");
    });

    it("replaces spaces with hyphens", () => {
      expect(formatRepositoryName("my repo")).toBe("my-repo");
    });

    it("replaces multiple consecutive spaces with single hyphen", () => {
      expect(formatRepositoryName("my   repo")).toBe("my-repo");
    });

    it("handles leading whitespace", () => {
      expect(formatRepositoryName("  repo")).toBe("repo");
    });

    it("handles trailing whitespace", () => {
      expect(formatRepositoryName("repo  ")).toBe("repo");
    });

    it("handles leading and trailing whitespace", () => {
      expect(formatRepositoryName("  repo-name  ")).toBe("repo-name");
    });

    it("handles mixed case", () => {
      expect(formatRepositoryName("MyRepoName")).toBe("myreponame");
    });

    it("returns empty string for input that trims to empty", () => {
      expect(formatRepositoryName("   ")).toBe("");
    });

    it("preserves numbers in name", () => {
      expect(formatRepositoryName("repo123")).toBe("repo123");
    });

    it("handles hyphens already present", () => {
      expect(formatRepositoryName("my-repo-name")).toBe("my-repo-name");
    });

    it("handles spaces and hyphens together", () => {
      expect(formatRepositoryName("  My Repo - Name  ")).toBe("my-repo---name");
    });
  });
});
