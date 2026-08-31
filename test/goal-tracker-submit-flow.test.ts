import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitGoalWithRefresh, type CreateGoalPayload } from "@/lib/goal-tracker";

const basePayload: CreateGoalPayload = {
  title: "Ship more fixes",
  target: 5,
  unit: "commits",
  recurrence: "none",
  deadline: null,
};

describe("submitGoalWithRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a create error when the POST request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    const handleSync = vi.fn();
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: basePayload,
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: false,
      error: "Failed to create goal. Please try again.",
    });
    expect(handleSync).not.toHaveBeenCalled();
    expect(loadGoals).not.toHaveBeenCalled();
  });

  it("returns the API error message when duplicate title is rejected", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: "Task with this title already exists",
          code: "DUPLICATE_TASK_TITLE",
        }),
    });
    const handleSync = vi.fn();
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: basePayload,
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: false,
      error: "Task with this title already exists",
    });
    expect(handleSync).not.toHaveBeenCalled();
    expect(loadGoals).not.toHaveBeenCalled();
  });

  it("keeps the goal created and returns a refresh error when sync fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn().mockRejectedValue(new Error("sync failed"));
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: basePayload,
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: true,
      error: "Goal created, but refreshing goals failed. Please try refreshing.",
    });
    expect(handleSync).toHaveBeenCalledTimes(1);
    expect(loadGoals).not.toHaveBeenCalled();
  });

  it("reloads goals for non auto-synced units", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn();
    const loadGoals = vi.fn().mockResolvedValue(undefined);

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: { ...basePayload, unit: "hours" },
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: true,
      error: null,
    });
    expect(handleSync).not.toHaveBeenCalled();
    expect(loadGoals).toHaveBeenCalledTimes(1);
  });

  it("calls handleSync for commits unit when request succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn().mockResolvedValue(undefined);
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: basePayload,
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: true,
      error: null,
    });
    expect(handleSync).toHaveBeenCalledTimes(1);
    expect(loadGoals).not.toHaveBeenCalled();
  });

  it("calls handleSync for prs unit when request succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn().mockResolvedValue(undefined);
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: { ...basePayload, unit: "prs" },
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: true,
      error: null,
    });
    expect(handleSync).toHaveBeenCalledTimes(1);
    expect(loadGoals).not.toHaveBeenCalled();
  });

  it("handles network error during fetch", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("Network error"));
    const handleSync = vi.fn();
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: basePayload,
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: false,
      error: "Failed to create goal. Please try again.",
    });
    expect(handleSync).not.toHaveBeenCalled();
    expect(loadGoals).not.toHaveBeenCalled();
  });

  it("handles loadGoals failure gracefully", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn();
    const loadGoals = vi.fn().mockRejectedValue(new Error("Load failed"));

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: { ...basePayload, unit: "hours" },
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: true,
      error: "Goal created, but refreshing goals failed. Please try refreshing.",
    });
  });

  it("handles handleSync failure with created true", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn().mockRejectedValue(new Error("Sync error"));
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl,
      payload: basePayload,
      handleSync,
      loadGoals,
    });

    expect(result.created).toBe(true);
    expect(result.error).toContain("refreshing goals failed");
  });

  it("uses provided fetchImpl when passed", async () => {
    const customFetch = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn().mockResolvedValue(undefined);
    const loadGoals = vi.fn();

    const result = await submitGoalWithRefresh({
      fetchImpl: customFetch,
      payload: basePayload,
      handleSync,
      loadGoals,
    });

    expect(result).toEqual({
      created: true,
      error: null,
    });
    expect(customFetch).toHaveBeenCalled();
  });

  it("sends correct payload to API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    const handleSync = vi.fn().mockResolvedValue(undefined);
    const loadGoals = vi.fn();

    const payloadWithDeadline: CreateGoalPayload = {
      title: "New Goal",
      target: 10,
      unit: "prs",
      recurrence: "weekly",
      deadline: "2026-06-30",
    };

    await submitGoalWithRefresh({
      fetchImpl: mockFetch,
      payload: payloadWithDeadline,
      handleSync,
      loadGoals,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/goals",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadWithDeadline),
      })
    );
  });
});

describe("CreateGoalPayload types", () => {
  it("accepts valid recurrence values", () => {
    const validPayloads: CreateGoalPayload[] = [
      { ...basePayload, recurrence: "none" },
      { ...basePayload, recurrence: "weekly" },
      { ...basePayload, recurrence: "monthly" },
    ];

    validPayloads.forEach((payload) => {
      expect(["none", "weekly", "monthly"]).toContain(payload.recurrence);
    });
  });

  it("accepts null deadline", () => {
    const payload: CreateGoalPayload = {
      ...basePayload,
      deadline: null,
    };
    expect(payload.deadline).toBeNull();
  });

  it("accepts string deadline", () => {
    const payload: CreateGoalPayload = {
      ...basePayload,
      deadline: "2026-06-30",
    };
    expect(payload.deadline).toBe("2026-06-30");
  });
});