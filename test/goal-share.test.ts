import { describe, expect, it } from "vitest";
import {
  buildPublicGoalSharePath,
  buildPublicGoalShareUrl,
  getGoalProgressPercent,
} from "@/lib/goals/share";

describe("goal sharing helpers", () => {
  it("builds the public goal path", () => {
    expect(buildPublicGoalSharePath("octocat", "goal-123")).toBe(
      "/u/octocat/goals/goal-123"
    );
  });

  it("encodes username and goal id safely", () => {
    expect(buildPublicGoalSharePath("octo cat", "goal/123")).toBe(
      "/u/octo%20cat/goals/goal%2F123"
    );
  });

  it("builds the full public goal URL", () => {
    expect(
      buildPublicGoalShareUrl("http://localhost:3000", "octocat", "goal-123")
    ).toBe("http://localhost:3000/u/octocat/goals/goal-123");
  });

  it("calculates clamped goal progress percentage", () => {
    expect(getGoalProgressPercent(40, 100)).toBe(40);
    expect(getGoalProgressPercent(120, 100)).toBe(100);
    expect(getGoalProgressPercent(-10, 100)).toBe(0);
    expect(getGoalProgressPercent(10, 0)).toBe(0);
  });
});