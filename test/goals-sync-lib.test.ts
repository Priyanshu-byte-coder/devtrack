import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
  githubRequest: vi.fn(),
  throwIfGitHubRateLimited: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock("@/lib/github-request", () => ({
  githubRequest: mocks.githubRequest,
}));

vi.mock("@/lib/github-rate-limit", () => ({
  throwIfGitHubRateLimited: mocks.throwIfGitHubRateLimited,
}));

import { GoalDatabaseError, syncGoalsForUser } from "@/lib/goals-sync";

type GoalRecord = {
  id: string;
  unit: string;
  repo: string | null;
  period_start: string | null;
  recurrence: "none" | "weekly" | "monthly" | string;
  created_at: string | null;
};

function createMockSupabaseChain({
  goals = [] as GoalRecord[],
  fetchError = null as Error | { message: string } | null,
  updateError = null as Error | { message: string } | null,
} = {}) {
  const updatePayloads: Array<{
    payload: Record<string, unknown>;
    id?: string;
    userId?: string;
  }> = [];

  const updateEqUserId = vi
    .fn()
    .mockImplementation((_column: string, val: string) => {
      const current = updatePayloads[updatePayloads.length - 1];
      if (current) current.userId = val;
      return Promise.resolve({ data: null, error: updateError });
    });

  const updateEqId = vi
    .fn()
    .mockImplementation((_column: string, val: string) => {
      const current = updatePayloads[updatePayloads.length - 1];
      if (current) current.id = val;
      return { eq: updateEqUserId };
    });

  const updateFn = vi
    .fn()
    .mockImplementation((payload: Record<string, unknown>) => {
      updatePayloads.push({ payload });
      return { eq: updateEqId };
    });

  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: fetchError ? null : goals,
      error: fetchError,
    }),
    update: updateFn,
  };

  mocks.supabaseAdmin.from.mockImplementation((table: string) => {
    if (table === "goals") {
      return selectChain;
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: updateFn,
    };
  });

  return { selectChain, updateFn, updateEqId, updateEqUserId, updatePayloads };
}

function mockGitHubSearchResponse(
  totalCount: number,
  incompleteResults = false
) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({
      total_count: totalCount,
      incomplete_results: incompleteResults,
    }),
  };
}

describe("syncGoalsForUser — src/lib/goals-sync.ts", () => {
  const userId = "user-uuid-123";
  const login = "octocat";
  const token = "gho_secret_token";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-20T12:00:00.000Z")); // Wednesday
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Goal progress calculation across all supported units", () => {
    const units = [
      {
        unit: "commits",
        endpoint: "commits",
        queryTokens: ["author:octocat", "author-date:"],
      },
      {
        unit: "prs",
        endpoint: "issues",
        queryTokens: ["author:octocat", "type:pr", "is:merged", "merged:"],
      },
      {
        unit: "reviews",
        endpoint: "issues",
        queryTokens: ["reviewed-by:octocat", "type:pr", "updated:"],
      },
      {
        unit: "issues_closed",
        endpoint: "issues",
        queryTokens: [
          "assignee:octocat",
          "type:issue",
          "state:closed",
          "closed:",
        ],
      },
      {
        unit: "issues_opened",
        endpoint: "issues",
        queryTokens: ["author:octocat", "type:issue", "created:"],
      },
      {
        unit: "open_source_prs",
        endpoint: "issues",
        queryTokens: [
          "author:octocat",
          "type:pr",
          "is:merged",
          "merged:",
          "-user:octocat",
        ],
      },
    ];

    for (const { unit, endpoint, queryTokens } of units) {
      it(`calculates and updates progress for unit: ${unit}`, async () => {
        const goal: GoalRecord = {
          id: `goal-${unit}-1`,
          unit,
          repo: null,
          period_start: "2026-05-18T00:00:00.000Z",
          recurrence: "weekly",
          created_at: "2026-05-01T00:00:00.000Z",
        };

        const { updatePayloads } = createMockSupabaseChain({ goals: [goal] });
        mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(14));

        const result = await syncGoalsForUser(userId, login, token);

        expect(result).toEqual({ updated: 1 });
        expect(mocks.githubRequest).toHaveBeenCalledTimes(1);

        const [requestUrl, requestOptions] = mocks.githubRequest.mock.calls[0];
        expect(requestUrl).toContain(
          `https://api.github.com/search/${endpoint}?`
        );
        const decoded = decodeURIComponent(requestUrl.replace(/\+/g, " "));
        for (const tokenStr of queryTokens) {
          expect(decoded).toContain(tokenStr);
        }
        expect(requestOptions.headers).toEqual({
          Authorization: `Bearer ${token}`,
        });

        expect(updatePayloads).toHaveLength(1);
        expect(updatePayloads[0]).toEqual({
          payload: {
            current: 14,
            last_synced_at: "2026-05-20T12:00:00.000Z",
          },
          id: goal.id,
          userId,
        });
      });
    }

    it("appends valid repo qualifier when repo is provided and valid", async () => {
      const goal: GoalRecord = {
        id: "goal-repo-valid",
        unit: "commits",
        repo: "owner/cool-repo",
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(5));

      await syncGoalsForUser(userId, login, token);

      const [requestUrl] = mocks.githubRequest.mock.calls[0];
      expect(decodeURIComponent(requestUrl)).toContain("repo:owner/cool-repo");
    });

    it("ignores invalid repo qualifier according to extractValidRepoFromGoal rules", async () => {
      const goal: GoalRecord = {
        id: "goal-repo-invalid",
        unit: "commits",
        repo: "invalid-repo-name-without-owner",
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(3));

      await syncGoalsForUser(userId, login, token);

      const [requestUrl] = mocks.githubRequest.mock.calls[0];
      expect(decodeURIComponent(requestUrl)).not.toContain("repo:");
    });
  });

  describe("Recurrence and period calculation", () => {
    it("calculates weekly periodStart as UTC Monday midnight", async () => {
      // 2026-05-20 is Wednesday; Monday of that week is 2026-05-18 00:00:00 UTC
      const goal: GoalRecord = {
        id: "goal-weekly",
        unit: "commits",
        repo: null,
        period_start: null,
        recurrence: "weekly",
        created_at: "2026-01-01T00:00:00.000Z",
      };

      createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(10));

      await syncGoalsForUser(userId, login, token);

      const [url] = mocks.githubRequest.mock.calls[0];
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain(
        "author-date:2026-05-18T00:00:00.000Z..2026-05-20T12:00:00.000Z"
      );
    });

    it("calculates monthly periodStart as 1st of current UTC month", async () => {
      // 2026-05-20 -> 1st of May 2026
      const goal: GoalRecord = {
        id: "goal-monthly",
        unit: "commits",
        repo: null,
        period_start: null,
        recurrence: "monthly",
        created_at: "2026-01-01T00:00:00.000Z",
      };

      createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(25));

      await syncGoalsForUser(userId, login, token);

      const [url] = mocks.githubRequest.mock.calls[0];
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain(
        "author-date:2026-05-01T00:00:00.000Z..2026-05-20T12:00:00.000Z"
      );
    });

    it("uses period_start if recurrence is neither weekly nor monthly", async () => {
      const goal: GoalRecord = {
        id: "goal-custom",
        unit: "commits",
        repo: null,
        period_start: "2026-05-10T08:00:00.000Z",
        recurrence: "daily",
        created_at: "2026-01-01T00:00:00.000Z",
      };

      createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(4));

      await syncGoalsForUser(userId, login, token);

      const [url] = mocks.githubRequest.mock.calls[0];
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain(
        "author-date:2026-05-10T08:00:00.000Z..2026-05-20T12:00:00.000Z"
      );
    });

    it("for recurrence='none', advances periodStart to created_at if created_at is later", async () => {
      const goal: GoalRecord = {
        id: "goal-none-recurrence",
        unit: "commits",
        repo: null,
        period_start: "2026-05-10T00:00:00.000Z",
        recurrence: "none",
        created_at: "2026-05-15T09:30:00.000Z",
      };

      createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(7));

      await syncGoalsForUser(userId, login, token);

      const [url] = mocks.githubRequest.mock.calls[0];
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain(
        "author-date:2026-05-15T09:30:00.000Z..2026-05-20T12:00:00.000Z"
      );
    });

    it("skips recurring goals if goal.period_start is strictly before the current periodStart (unarchived rollover)", async () => {
      // Current Monday is 2026-05-18T00:00:00.000Z.
      // If goal.period_start is from previous week, e.g. 2026-05-11T00:00:00.000Z, it must be skipped.
      const unarchivedGoal: GoalRecord = {
        id: "goal-stale-rollover",
        unit: "commits",
        repo: null,
        period_start: "2026-05-11T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const freshGoal: GoalRecord = {
        id: "goal-current-period",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updatePayloads } = createMockSupabaseChain({
        goals: [unarchivedGoal, freshGoal],
      });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(8));

      const result = await syncGoalsForUser(userId, login, token);

      expect(result).toEqual({ updated: 1 });
      expect(updatePayloads).toHaveLength(1);
      expect(updatePayloads[0].id).toBe("goal-current-period");
      expect(updatePayloads[0].payload.current).toBe(8);
    });
  });

  describe("Query deduplication and caching across multiple goals", () => {
    it("reuses the same search count for identical queries and makes only one GitHub request", async () => {
      const goal1: GoalRecord = {
        id: "goal-1",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };
      const goal2: GoalRecord = {
        id: "goal-2",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updatePayloads } = createMockSupabaseChain({
        goals: [goal1, goal2],
      });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(15));

      const result = await syncGoalsForUser(userId, login, token);

      expect(result).toEqual({ updated: 2 });
      expect(mocks.githubRequest).toHaveBeenCalledTimes(1);
      expect(updatePayloads).toHaveLength(2);
      expect(updatePayloads[0]).toEqual({
        payload: { current: 15, last_synced_at: "2026-05-20T12:00:00.000Z" },
        id: "goal-1",
        userId,
      });
      expect(updatePayloads[1]).toEqual({
        payload: { current: 15, last_synced_at: "2026-05-20T12:00:00.000Z" },
        id: "goal-2",
        userId,
      });
    });

    it("makes separate GitHub requests for distinct goal queries", async () => {
      const goal1: GoalRecord = {
        id: "goal-commits",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };
      const goal2: GoalRecord = {
        id: "goal-prs",
        unit: "prs",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updatePayloads } = createMockSupabaseChain({
        goals: [goal1, goal2],
      });
      mocks.githubRequest
        .mockResolvedValueOnce(mockGitHubSearchResponse(12))
        .mockResolvedValueOnce(mockGitHubSearchResponse(3));

      const result = await syncGoalsForUser(userId, login, token);

      expect(result).toEqual({ updated: 2 });
      expect(mocks.githubRequest).toHaveBeenCalledTimes(2);
      expect(updatePayloads[0].payload.current).toBe(12);
      expect(updatePayloads[1].payload.current).toBe(3);
    });
  });

  describe("Goal completion & target handling as implemented", () => {
    it("persists exact current count regardless of whether it is below target (e.g. 0)", async () => {
      const goal: GoalRecord = {
        id: "goal-zero",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updatePayloads } = createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(0));

      const result = await syncGoalsForUser(userId, login, token);

      expect(result).toEqual({ updated: 1 });
      expect(updatePayloads[0].payload.current).toBe(0);
    });

    it("persists exact count when target is reached or exceeded (e.g. 500)", async () => {
      const goal: GoalRecord = {
        id: "goal-exceeded",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updatePayloads } = createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(mockGitHubSearchResponse(500));

      const result = await syncGoalsForUser(userId, login, token);

      expect(result).toEqual({ updated: 1 });
      expect(updatePayloads[0].payload.current).toBe(500);
      expect(updatePayloads[0].payload.last_synced_at).toBe(
        "2026-05-20T12:00:00.000Z"
      );
    });
  });

  describe("No-goals scenario", () => {
    it("returns { updated: 0, commitCount: 0 } immediately when no goals are found", async () => {
      const { updateFn } = createMockSupabaseChain({ goals: [] });

      const result = await syncGoalsForUser(userId, login, token);

      expect(result).toEqual({ updated: 0, commitCount: 0 });
      expect(mocks.githubRequest).not.toHaveBeenCalled();
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("returns { updated: 0, commitCount: 0 } when goals is null", async () => {
      mocks.supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn(),
      });

      const result = await syncGoalsForUser(userId, login, token);

      expect(result).toEqual({ updated: 0, commitCount: 0 });
      expect(mocks.githubRequest).not.toHaveBeenCalled();
    });
  });

  describe("GitHub API failure handling", () => {
    it("calls throwIfGitHubRateLimited and throws Error when response.ok is false", async () => {
      const goal: GoalRecord = {
        id: "goal-err",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updateFn } = createMockSupabaseChain({ goals: [goal] });
      const badResponse = {
        ok: false,
        status: 500,
        headers: new Headers(),
      };
      mocks.githubRequest.mockResolvedValueOnce(badResponse);

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        "GitHub API error"
      );
      expect(mocks.throwIfGitHubRateLimited).toHaveBeenCalledWith(badResponse);
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("throws rate limit error when throwIfGitHubRateLimited throws", async () => {
      const goal: GoalRecord = {
        id: "goal-rate-limit",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updateFn } = createMockSupabaseChain({ goals: [goal] });
      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: new Headers(),
      };
      mocks.githubRequest.mockResolvedValueOnce(rateLimitResponse);
      mocks.throwIfGitHubRateLimited.mockImplementationOnce(() => {
        throw new Error(
          "GitHub API rate limit reached. Please try again after the cooldown."
        );
      });

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        "GitHub API rate limit reached. Please try again after the cooldown."
      );
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("throws when GitHub returns incomplete_results: true", async () => {
      const goal: GoalRecord = {
        id: "goal-incomplete",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updateFn } = createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce(
        mockGitHubSearchResponse(10, true)
      );

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        "GitHub returned incomplete goal counts"
      );
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("throws when GitHub returns total_count that is not a safe integer or is negative", async () => {
      const goal: GoalRecord = {
        id: "goal-unsafe-count",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updateFn } = createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ total_count: -1 }),
      });

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        "GitHub returned incomplete goal counts"
      );
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("re-throws network/timeout exceptions from githubRequest without writing to database", async () => {
      const goal: GoalRecord = {
        id: "goal-timeout",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      const { updateFn } = createMockSupabaseChain({ goals: [goal] });
      mocks.githubRequest.mockRejectedValueOnce(new Error("Timeout aborted"));

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        "Timeout aborted"
      );
      expect(updateFn).not.toHaveBeenCalled();
    });
  });

  describe("Database failure handling", () => {
    it("throws GoalDatabaseError when initial goals fetch fails", async () => {
      createMockSupabaseChain({
        fetchError: { message: "Database connection failed" },
      });

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        GoalDatabaseError
      );
      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        "Failed to fetch goals"
      );
      expect(mocks.githubRequest).not.toHaveBeenCalled();
    });

    it("throws GoalDatabaseError when updating a goal fails", async () => {
      const goal: GoalRecord = {
        id: "goal-db-fail",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      createMockSupabaseChain({
        goals: [goal],
        updateError: { message: "Row lock timeout" },
      });
      mocks.githubRequest.mockResolvedValue(mockGitHubSearchResponse(10));

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        GoalDatabaseError
      );
      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        "Failed to update goals"
      );
    });

    it("aborts further updates and preserves previous progress if an update fails midway through multiple goals", async () => {
      const goal1: GoalRecord = {
        id: "goal-1",
        unit: "commits",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };
      const goal2: GoalRecord = {
        id: "goal-2",
        unit: "prs",
        repo: null,
        period_start: "2026-05-18T00:00:00.000Z",
        recurrence: "weekly",
        created_at: "2026-05-01T00:00:00.000Z",
      };

      let callCount = 0;
      mocks.supabaseAdmin.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [goal1, goal2], error: null }),
        update: vi.fn().mockImplementation(() => ({
          eq: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve({
                  data: null,
                  error: { message: "Failed write" },
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
          })),
        })),
      });

      mocks.githubRequest
        .mockResolvedValueOnce(mockGitHubSearchResponse(5))
        .mockResolvedValueOnce(mockGitHubSearchResponse(2));

      await expect(syncGoalsForUser(userId, login, token)).rejects.toThrow(
        GoalDatabaseError
      );
      // The second goal update is not executed after the first fails
      expect(callCount).toBe(1);
    });
  });
});
