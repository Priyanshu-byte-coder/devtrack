import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitGoalWithRefresh } from "../src/lib/goal-tracker";

const makeFetchMock = (response: { ok: boolean; json: () => Promise<{ error?: string }> }) =>
  vi.fn().mockResolvedValue(response) as unknown as typeof fetch;

describe("goal-tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitGoalWithRefresh", () => {
    it("returns created=true when fetch succeeds with 200", async () => {
      const mockFetch = makeFetchMock({ ok: true, json: async () => ({}) });
      const handleSync = vi.fn().mockResolvedValue(undefined);
      const loadGoals = vi.fn().mockResolvedValue(undefined);

      const result = await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 10, unit: "commits", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(result.created).toBe(true);
      expect(result.error).toBeNull();
    });

    it("calls handleSync when unit is commits", async () => {
      const mockFetch = makeFetchMock({ ok: true, json: async () => ({}) });
      const handleSync = vi.fn().mockResolvedValue(undefined);
      const loadGoals = vi.fn().mockResolvedValue(undefined);

      await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 10, unit: "commits", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(handleSync).toHaveBeenCalled();
      expect(loadGoals).not.toHaveBeenCalled();
    });

    it("calls handleSync when unit is prs", async () => {
      const mockFetch = makeFetchMock({ ok: true, json: async () => ({}) });
      const handleSync = vi.fn().mockResolvedValue(undefined);
      const loadGoals = vi.fn().mockResolvedValue(undefined);

      await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 5, unit: "prs", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(handleSync).toHaveBeenCalled();
      expect(loadGoals).not.toHaveBeenCalled();
    });

    it("calls loadGoals when unit is not commits or prs", async () => {
      const mockFetch = makeFetchMock({ ok: true, json: async () => ({}) });
      const handleSync = vi.fn().mockResolvedValue(undefined);
      const loadGoals = vi.fn().mockResolvedValue(undefined);

      await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 3, unit: "hours", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(loadGoals).toHaveBeenCalled();
      expect(handleSync).not.toHaveBeenCalled();
    });

    it("returns created=false when fetch throws", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error")) as unknown as typeof fetch;
      const handleSync = vi.fn();
      const loadGoals = vi.fn();

      const result = await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 10, unit: "commits", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(result.created).toBe(false);
      expect(result.error).toBe("Failed to create goal. Please try again.");
    });

    it("returns created=false with generic message when fetch returns non-ok", async () => {
      const mockFetch = makeFetchMock({ ok: false, json: async () => ({}) });
      const handleSync = vi.fn();
      const loadGoals = vi.fn();

      const result = await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 10, unit: "commits", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(result.created).toBe(false);
      expect(result.error).toBe("Failed to create goal. Please try again.");
    });

    it("returns error message from response when available", async () => {
      const mockFetch = makeFetchMock({ ok: false, json: async () => ({ error: "Custom validation error" }) });
      const handleSync = vi.fn();
      const loadGoals = vi.fn();

      const result = await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 10, unit: "commits", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(result.created).toBe(false);
      expect(result.error).toBe("Custom validation error");
    });

    it("returns created=true but error when handleSync throws", async () => {
      const mockFetch = makeFetchMock({ ok: true, json: async () => ({}) });
      const handleSync = vi.fn().mockRejectedValue(new Error("Sync failed"));
      const loadGoals = vi.fn();

      const result = await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 10, unit: "commits", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(result.created).toBe(true);
      expect(result.error).toBe("Goal created, but refreshing goals failed. Please try refreshing.");
    });

    it("returns created=true but error when loadGoals throws", async () => {
      const mockFetch = makeFetchMock({ ok: true, json: async () => ({}) });
      const handleSync = vi.fn();
      const loadGoals = vi.fn().mockRejectedValue(new Error("Load failed"));

      const result = await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Test", target: 10, unit: "hours", recurrence: "none", deadline: null },
        handleSync,
        loadGoals,
      });

      expect(result.created).toBe(true);
      expect(result.error).toBe("Goal created, but refreshing goals failed. Please try refreshing.");
    });

    it("sends POST request with JSON payload", async () => {
      const mockFetch = makeFetchMock({ ok: true, json: async () => ({}) });
      const handleSync = vi.fn().mockResolvedValue(undefined);
      const loadGoals = vi.fn();

      await submitGoalWithRefresh({
        fetchImpl: mockFetch,
        payload: { title: "Hit 50 PRs", target: 50, unit: "prs", recurrence: "monthly", deadline: "2026-07-01" },
        handleSync,
        loadGoals,
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Hit 50 PRs", target: 50, unit: "prs", recurrence: "monthly", deadline: "2026-07-01" }),
      });
    });
  });
});
