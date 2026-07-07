import { describe, it, expect } from "vitest";
import { extractValidRepoFromGoal } from "@/lib/goals-sync-utils";
import type { ActivityGoal } from "@/lib/goals-sync-utils";

function makeGoal(overrides: Partial<ActivityGoal> = {}): ActivityGoal {
  return {
    id: "goal-1",
    unit: "commits",
    repo: null,
    repository: null,
    repo_name: null,
    ...overrides,
  };
}

describe("goals-sync-utils", () => {
  describe("extractValidRepoFromGoal", () => {
    it("returns owner/repo unchanged when repo field is valid", () => {
      const goal = makeGoal({ repo: "owner/repo" });
      expect(extractValidRepoFromGoal(goal)).toBe("owner/repo");
    });

    it("returns repository field as owner/repo when repo is null", () => {
      const goal = makeGoal({ repo: null, repository: "my-org/my-repo" });
      expect(extractValidRepoFromGoal(goal)).toBe("my-org/my-repo");
    });

    it("returns repo_name field as owner/repo when repo and repository are null", () => {
      const goal = makeGoal({ repo: null, repository: null, repo_name: "foo/bar" });
      expect(extractValidRepoFromGoal(goal)).toBe("foo/bar");
    });

    it("prefers repo over repository when both are set", () => {
      const goal = makeGoal({ repo: "first/second", repository: "third/fourth" });
      expect(extractValidRepoFromGoal(goal)).toBe("first/second");
    });

    it("prefers repository over repo_name when repo is null", () => {
      const goal = makeGoal({ repo: null, repository: "second/third", repo_name: "first/second" });
      expect(extractValidRepoFromGoal(goal)).toBe("second/third");
    });

    it("returns null when all fields are null", () => {
      const goal = makeGoal({ repo: null, repository: null, repo_name: null });
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("returns null for empty string", () => {
      const goal = makeGoal({ repo: "" });
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("returns null for whitespace-only string", () => {
      const goal = makeGoal({ repo: "   " });
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("returns null for invalid identifier (no slash)", () => {
      const goal = makeGoal({ repo: "justareponame" });
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("returns null for identifier with extra path segments", () => {
      const goal = makeGoal({ repo: "owner/repo/extra" });
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("returns null when repo is '.'", () => {
      const goal = makeGoal({ repo: "owner/." });
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("returns null when repo is '..'", () => {
      const goal = makeGoal({ repo: "owner/.." });
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("trims leading and trailing whitespace", () => {
      const goal = makeGoal({ repo: "  owner/repo  " });
      expect(extractValidRepoFromGoal(goal)).toBe("owner/repo");
    });

    it("returns null for non-string values in repo field (number)", () => {
      const goal = makeGoal({ repo: null, repository: null, repo_name: null }) as any;
      goal.repo = 123 as any;
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("returns null for non-string values in repo field (object)", () => {
      const goal = makeGoal({ repo: null, repository: null, repo_name: null }) as any;
      goal.repo = { name: "owner/repo" } as any;
      expect(extractValidRepoFromGoal(goal)).toBeNull();
    });

    it("accepts repo name with dots", () => {
      const goal = makeGoal({ repo: "owner/repo.name" });
      expect(extractValidRepoFromGoal(goal)).toBe("owner/repo.name");
    });

    it("accepts repo name with hyphens", () => {
      const goal = makeGoal({ repo: "my-org/my-repo-name" });
      expect(extractValidRepoFromGoal(goal)).toBe("my-org/my-repo-name");
    });

    it("accepts repo name with underscores", () => {
      const goal = makeGoal({ repo: "owner/repo_name" });
      expect(extractValidRepoFromGoal(goal)).toBe("owner/repo_name");
    });
  });
});
