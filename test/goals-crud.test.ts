import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/goals/route";
import { PATCH, DELETE } from "@/app/api/goals/[id]/route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  dispatchToAllWebhooks: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));
vi.mock("@/lib/webhooks", () => ({
  dispatchToAllWebhooks: mocks.dispatchToAllWebhooks,
}));
function buildGoal(overrides: Record<string, unknown> = {}) {
  return {
    id: "goal-1",
    user_id: "user-1",
    title: "Test goal",
    target: 10,
    current: 0,
    unit: "commits",
    recurrence: "none",
    deadline: null,
    period_start: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makePostRequest(body: unknown): [Request] {
  return [
    new Request("http://localhost/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  ];
}

function makePatchRequest(body: unknown, goalId = "goal-1"): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: goalId }) },
  ];
}

function makeDeleteRequest(goalId = "goal-1"): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/goals/${goalId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: goalId }) },
  ];
}

describe("GET /api/goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ githubId: "gh-123", githubLogin: "alice" });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns goals for the authenticated user", async () => {
    const goals = [
      buildGoal({ id: "goal-1" }),
      buildGoal({ id: "goal-2", title: "Second goal" }),
    ];
    const limitFn = vi.fn().mockResolvedValue({ data: goals, error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });

    const inOrderFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const inFn = vi.fn().mockReturnValue({ order: inOrderFn });
    const eqFn2 = vi.fn().mockReturnValue({ in: inFn });

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "goals") {
        return {
          select: vi.fn().mockReturnValue({ eq: eqFn }),
        };
      }
      if (table === "goal_history") {
        return {
          select: vi.fn().mockReturnValue({ eq: eqFn2 }),
        };
      }
      return {};
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goals).toHaveLength(2);
  });

  it("returns an empty array when the user has no goals", async () => {
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eqFn }),
    });
    const res = await GET();
    const body = await res.json();
    expect(body.goals).toEqual([]);
  });
});

describe("POST /api/goals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ githubId: "gh-123", githubLogin: "alice" });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
    mocks.dispatchToAllWebhooks.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const [req] = makePostRequest({ title: "Test", target: 10, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates a goal and returns it with status 201", async () => {
    const createdGoal = buildGoal({ title: "New goal", target: 5, unit: "prs" });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdGoal, error: null }),
        }),
      }),
    });
    const [req] = makePostRequest({ title: "New goal", target: 5, unit: "prs" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.goal.title).toBe("New goal");
    expect(body.goal.target).toBe(5);
  });

  it("returns 400 when title is omitted", async () => {
    const [req] = makePostRequest({ target: 10, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when target exceeds the maximum", async () => {
    const [req] = makePostRequest({ title: "Goal", target: 10001, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when a goal with the same title already exists", async () => {
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "goal-existing" }, error: null }),
          }),
        }),
      }),
    });
    const [req] = makePostRequest({ title: "Read docs", target: 10, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Task with this title already exists");
    expect(body.code).toBe("DUPLICATE_TASK_TITLE");
  });

  it("returns 400 when the user already has the maximum number of goals", async () => {
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
        }),
    });
    const [req] = makePostRequest({ title: "Another goal", target: 10, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should accept missing unit and default to commits", async () => {
    const createdGoal = buildGoal({ title: "No unit", target: 5, unit: "commits" });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdGoal, error: null }),
        }),
      }),
    });
    const [req] = makePostRequest({ title: "No unit", target: 5 });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.goal.unit).toBe("commits");
  });

  it("returns 400 when unit is invalid", async () => {
    const [req] = makePostRequest({ title: "Invalid unit", target: 5, unit: "invalid-unit" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unit must be commits, prs, hours, streak, or language");
  });

  it("should reject invalid recurrence", async () => {
    const [req] = makePostRequest({
      title: "Invalid recurrence",
      target: 5,
      unit: "commits",
      recurrence: "daily",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("recurrence must be 'none', 'weekly', or 'monthly'");
  });

  it("should accept missing recurrence", async () => {
    const createdGoal = buildGoal({ title: "No recurrence", target: 5, unit: "commits", recurrence: "none" });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn()
        .mockReturnValueOnce({
          eq: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: createdGoal, error: null }),
        }),
      }),
    });
    const [req] = makePostRequest({ title: "No recurrence", target: 5, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.goal.recurrence).toBe("none");
  });

  it("should reject title exceeding 100 characters", async () => {
    const longTitle = "a".repeat(101);
    const [req] = makePostRequest({ title: longTitle, target: 5, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("title must be 100 characters or fewer");
  });

  it("should reject target below 1", async () => {
    const [req] = makePostRequest({ title: "Target below 1", target: 0, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("target must be an integer between 1 and 10000");
  });

  it("should reject target above 10000", async () => {
    const [req] = makePostRequest({ title: "Target above max", target: 10001, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("target must be an integer between 1 and 10000");
  });

  it("should reject HTML-only title that becomes empty after stripHtml", async () => {
    const [req] = makePostRequest({ title: "<b></b>", target: 5, unit: "commits" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("title must not be empty");
  });
});

describe("PATCH /api/goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ githubId: "gh-123", githubLogin: "alice" });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
    mocks.dispatchToAllWebhooks.mockResolvedValue(undefined);
  });

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const [req, ctx] = makePatchRequest({ title: "Updated" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the goal does not exist", async () => {
    const singleFn = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const eq2Fn = vi.fn().mockReturnValue({ single: singleFn });
    const eq1Fn = vi.fn().mockReturnValue({ eq: eq2Fn });
    mocks.supabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: eq1Fn }),
    });
    const [req, ctx] = makePatchRequest({ title: "Updated" }, "nonexistent");
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  it("updates the goal title and target", async () => {
    const existing = buildGoal({ title: "Original", target: 10, unit: "hours" });
    const updated = { ...existing, title: "Updated", target: 20 };
    const selectSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const selectEq2 = vi.fn().mockReturnValue({ single: selectSingle });
    const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
    const selectChain = vi.fn().mockReturnValue({ eq: selectEq1 });
    const updateSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const updateEq2 = vi.fn().mockReturnValue({ select: updateSelect });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const updateChain = vi.fn().mockReturnValue({ eq: updateEq1 });
    mocks.supabaseFrom.mockReturnValue({
      select: selectChain,
      update: updateChain,
    });
    const [req, ctx] = makePatchRequest({ title: "Updated", target: 20 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goal.title).toBe("Updated");
    expect(body.goal.target).toBe(20);
  });

  it("returns 400 for an invalid JSON body", async () => {
    const req = new Request("http://localhost/api/goals/goal-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "goal-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when unit in patch is invalid", async () => {
    const [req, ctx] = makePatchRequest({ unit: "invalid-unit" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unit must be commits, prs, hours, streak, or language");
  });
});

describe("DELETE /api/goals/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ githubId: "gh-123", githubLogin: "alice" });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
  });

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(401);
  });

  it("deletes the goal and returns success", async () => {
    const eq2Fn = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq1Fn = vi.fn().mockReturnValue({ eq: eq2Fn });
    mocks.supabaseFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: eq1Fn }),
    });
    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when the database delete fails", async () => {
    const eq2Fn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
    const eq1Fn = vi.fn().mockReturnValue({ eq: eq2Fn });
    mocks.supabaseFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({ eq: eq1Fn }),
    });
    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(500);
  });

  it("returns 404 when the user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    const [req, ctx] = makeDeleteRequest();
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(404);
  });
});
