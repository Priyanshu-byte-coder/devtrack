import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/goals/[id]/route";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

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

// ─── helpers ────────────────────────────────────────────────────────────────

function buildGoal(overrides: Record<string, unknown> = {}) {
  return {
    id: "goal-1",
    user_id: "user-1",
    title: "Test goal",
    target: 10,
    current: 0,
    unit: "hours",
    recurrence: "none",
    deadline: null,
    period_start: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRequest(body: unknown, goalId = "goal-1"): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/goals/${goalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return [req, { params: Promise.resolve({ id: goalId }) }];
}

function setupSupabase(goal: ReturnType<typeof buildGoal> | null, updateResult?: ReturnType<typeof buildGoal>) {
  const selectSingle = vi.fn().mockResolvedValue({ data: goal, error: goal ? null : { message: "not found" } });
  const selectEq2 = vi.fn().mockReturnValue({ single: selectSingle });
  const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
  const selectChain = vi.fn().mockReturnValue({ eq: selectEq1 });

  const updateSingle = vi.fn().mockResolvedValue({
    data: updateResult ?? { ...(goal ?? {}), current: 5 },
    error: null,
  });
  const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
  const updateEq2 = vi.fn().mockReturnValue({ select: updateSelect });
  const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
  const updateChain = vi.fn().mockReturnValue({ eq: updateEq1 });

  mocks.supabaseFrom.mockReturnValue({
    select: selectChain,
    update: updateChain,
  });

  return { selectSingle, updateEq1, updateChain };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("PATCH /api/goals/[id] — progress integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ githubId: "gh-123", githubLogin: "alice" });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
    mocks.dispatchToAllWebhooks.mockResolvedValue(undefined);
  });

  // ── authentication ────────────────────────────────────────────────────────

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const [req, ctx] = makeRequest({ current: 5 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    setupSupabase(buildGoal());
    const [req, ctx] = makeRequest({ current: 5 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  // ── input validation ──────────────────────────────────────────────────────

  it("allows missing current field", async () => {
    setupSupabase(buildGoal());
    const [req, ctx] = makeRequest({});
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
  });

  it("rejects a float value for current", async () => {
    setupSupabase(buildGoal());
    const [req, ctx] = makeRequest({ current: 5.5 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non-negative integer/);
  });

  it("rejects a negative value for current", async () => {
    setupSupabase(buildGoal());
    const [req, ctx] = makeRequest({ current: -1 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  it("rejects a string value for current", async () => {
    setupSupabase(buildGoal());
    const [req, ctx] = makeRequest({ current: "10" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
  });

  // ── goal not found ────────────────────────────────────────────────────────

  it("returns 404 when the goal does not belong to the user", async () => {
    setupSupabase(null);
    const [req, ctx] = makeRequest({ current: 5 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  // ── activity-derived unit guard (the core security fix) ───────────────────

  it("rejects progress update for a commits goal with 422", async () => {
    setupSupabase(buildGoal({ unit: "commits", target: 20 }));
    const [req, ctx] = makeRequest({ current: 20 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/GitHub sync/);
  });

  it("rejects progress update for a prs goal with 422", async () => {
    setupSupabase(buildGoal({ unit: "prs", target: 5 }));
    const [req, ctx] = makeRequest({ current: 5 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/GitHub sync/);
  });

  it("blocks completing a commits goal via an arbitrary PATCH — regression test for #1753", async () => {
    // A user with zero real commits tries to set current = target
    setupSupabase(buildGoal({ unit: "commits", current: 0, target: 50 }));
    const [req, ctx] = makeRequest({ current: 50 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
  });

  it("blocks setting partial progress on a prs goal via PATCH", async () => {
    setupSupabase(buildGoal({ unit: "prs", current: 1, target: 10 }));
    const [req, ctx] = makeRequest({ current: 3 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
  });

  // ── upper-bound guard ─────────────────────────────────────────────────────

  it("rejects current > target for a manual goal", async () => {
    setupSupabase(buildGoal({ unit: "hours", target: 10 }));
    const [req, ctx] = makeRequest({ current: 11 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot exceed target/);
  });

  it("allows current === target for a manual goal (completion)", async () => {
    const goal = buildGoal({ unit: "hours", target: 10, current: 0 });
    const updated = { ...goal, current: 10 };
    setupSupabase(goal, updated);
    const [req, ctx] = makeRequest({ current: 10 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goal.current).toBe(10);
  });

  // ── legitimate manual-goal updates ───────────────────────────────────────

  it("allows progress update for a manually tracked hours goal", async () => {
    const goal = buildGoal({ unit: "hours", target: 8, current: 0 });
    const updated = { ...goal, current: 4 };
    setupSupabase(goal, updated);
    const [req, ctx] = makeRequest({ current: 4 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goal.current).toBe(4);
  });

  it("allows progress update for a custom unit goal", async () => {
    const goal = buildGoal({ unit: "books", target: 3, current: 1 });
    const updated = { ...goal, current: 2 };
    setupSupabase(goal, updated);
    const [req, ctx] = makeRequest({ current: 2 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
  });

  it("allows setting current to 0 (progress reset) for a manual goal", async () => {
    const goal = buildGoal({ unit: "tasks", target: 5, current: 3 });
    const updated = { ...goal, current: 0 };
    setupSupabase(goal, updated);
    const [req, ctx] = makeRequest({ current: 0 });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
  });

  // ── webhook dispatch on completion ────────────────────────────────────────

  it("dispatches goal.completed webhook when a manual goal crosses the target", async () => {
    const goal = buildGoal({ unit: "hours", target: 5, current: 4 });
    const updated = { ...goal, current: 5 };
    setupSupabase(goal, updated);
    const [req, ctx] = makeRequest({ current: 5 });
    await PATCH(req, ctx);
    expect(mocks.dispatchToAllWebhooks).toHaveBeenCalledWith(
      "user-1",
      "goal.completed",
      expect.objectContaining({ goalId: "goal-1" })
    );
  });

  it("does not dispatch a completion webhook when the goal was already complete", async () => {
    const goal = buildGoal({ unit: "hours", target: 5, current: 5 });
    const updated = { ...goal, current: 5 };
    setupSupabase(goal, updated);
    const [req, ctx] = makeRequest({ current: 5 });
    await PATCH(req, ctx);
    expect(mocks.dispatchToAllWebhooks).not.toHaveBeenCalled();
  });

  it("does not dispatch a completion webhook when the update does not reach the target", async () => {
    const goal = buildGoal({ unit: "hours", target: 10, current: 2 });
    const updated = { ...goal, current: 5 };
    setupSupabase(goal, updated);
    const [req, ctx] = makeRequest({ current: 5 });
    await PATCH(req, ctx);
    expect(mocks.dispatchToAllWebhooks).not.toHaveBeenCalled();
  });
});
