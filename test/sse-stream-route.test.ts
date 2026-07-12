// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { activeStreamConnections } from "@/lib/sse";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/get-session-token", () => ({
  getAccessToken: vi.fn(async () => {
    const { getServerSession } = await import("next-auth");
    const session = await (getServerSession as any)();
    return session?.accessToken ?? null;
  }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  const controller = new AbortController();
  const req = new NextRequest("http://localhost/api/stream");
  Object.defineProperty(req, 'signal', { value: controller.signal });
  return req;
}

function makeAbortableRequest(): { req: NextRequest; abort: () => void } {
  const controller = new AbortController();
  const req = new NextRequest("http://localhost/api/stream");
  Object.defineProperty(req, 'signal', { value: controller.signal });
  return { req, abort: () => controller.abort() };
}

function makePreAbortedRequest(): NextRequest {
  const controller = new AbortController();
  controller.abort();
  return new NextRequest("http://localhost/api/stream", {
    signal: controller.signal,
  });
}

function setupSupabase(
  goalSyncedAt: string | null = "2026-01-01T00:00:00Z",
  unreadCount = 0
) {
  // goals query chain: .from("goals").select().eq().order().limit()
  const goalsChain = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: goalSyncedAt ? [{ last_synced_at: goalSyncedAt }] : [],
      error: null,
    }),
  };
  const goalsSelect = vi.fn().mockReturnValue(goalsChain);

  // notifications query chain: .from("notifications").select().eq().eq()
  const notifChain = {
    eq: vi.fn().mockReturnThis(),
    // final .eq() resolves with count
    // we make the chain resolve at the second .eq call
  };
  // The notification query ends with two .eq() calls then awaits
  const notifInnerEq = vi.fn().mockResolvedValue({ count: unreadCount, error: null });
  const notifOuterEq = vi.fn().mockReturnValue({ eq: notifInnerEq });
  const notifSelect = vi.fn().mockReturnValue({ eq: notifOuterEq });

  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === "goals") return { select: goalsSelect };
    if (table === "notifications") return { select: notifSelect };
    return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }) };
  });
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("GET /api/stream — SSE stream route", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    activeStreamConnections.clear();

    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-1",
      githubLogin: "alice",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
    setupSupabase();
  });

  // ── authentication ────────────────────────────────────────────────────────

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when session has no githubId", async () => {
    mocks.getServerSession.mockResolvedValue({ githubLogin: "alice" });
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user cannot be resolved", async () => {
    mocks.resolveAppUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  // ── single connection ────────────────────────────────────────────────────

  it("returns a text/event-stream response for an authenticated user", async () => {
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("increments the connection counter when a stream is opened", async () => {
    const { GET } = await import("@/app/api/stream/route");
    await GET(makeRequest());
    expect(activeStreamConnections.get("user-1")).toBe(1);
  });

  // ── connection limit enforcement (regression test for #1752) ─────────────

  it("rejects a 5th connection from the same user with 429", async () => {
    // Manually set the counter to the cap value (4)
    activeStreamConnections.set("user-1", 4);
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("includes Retry-After header on 429 responses", async () => {
    activeStreamConnections.set("user-1", 4);
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not increment the counter when a connection is rejected", async () => {
    activeStreamConnections.set("user-1", 4);
    const { GET } = await import("@/app/api/stream/route");
    await GET(makeRequest());
    // Counter must remain at 4, not 5
    expect(activeStreamConnections.get("user-1")).toBe(4);
  });

  it("allows exactly MAX_CONNECTIONS_PER_USER concurrent connections", async () => {
    const { GET } = await import("@/app/api/stream/route");

    // Open 4 connections — all should succeed
    const results: Response[] = [];
    for (let i = 0; i < 4; i++) {
      results.push(await GET(makeRequest()));
    }
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(activeStreamConnections.get("user-1")).toBe(4);
  });

  it("allows different users to have independent connection slots", async () => {
    const { GET } = await import("@/app/api/stream/route");

    // user-1 is at the cap
    activeStreamConnections.set("user-1", 4);

    // user-2 connects for the first time — must succeed
    mocks.resolveAppUser.mockResolvedValue({ id: "user-2" });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(activeStreamConnections.get("user-2")).toBe(1);
  });

  // ── connection cleanup ─────────────────────────────────────────────────

  it("decrements the connection counter when the request is aborted", async () => {
    const { GET } = await import("@/app/api/stream/route");
    const { req, abort } = makeAbortableRequest();

    await GET(req);
    expect(activeStreamConnections.get("user-1")).toBe(1);

    abort();
    // Allow abort event listener to fire
    await new Promise((r) => setTimeout(r, 10));

    expect(activeStreamConnections.has("user-1")).toBe(false);
  });

  it("removes the user entry when the last connection closes", async () => {
    const { GET } = await import("@/app/api/stream/route");
    const { req, abort } = makeAbortableRequest();

    await GET(req);
    abort();
    await new Promise((r) => setTimeout(r, 10));

    // Entry should be fully removed, not set to 0
    expect(activeStreamConnections.has("user-1")).toBe(false);
  });

  it("frees one slot when one of multiple connections closes", async () => {
    const { GET } = await import("@/app/api/stream/route");

    // Open 3 connections — 2 fixed + 1 abortable
    await GET(makeRequest());
    await GET(makeRequest());
    const { req, abort } = makeAbortableRequest();
    await GET(req);

    expect(activeStreamConnections.get("user-1")).toBe(3);

    abort();
    await new Promise((r) => setTimeout(r, 10));

    // Should drop back to 2, not 0
    expect(activeStreamConnections.get("user-1")).toBe(2);
  });

  it("releases the connection slot when the request is already aborted", async () => {
    const { GET } = await import("@/app/api/stream/route");

    await GET(makePreAbortedRequest());

    expect(activeStreamConnections.has("user-1")).toBe(false);
  });

  it("closes stale streams and releases their slot after the max duration", async () => {
    vi.useFakeTimers();
    const { GET } = await import("@/app/api/stream/route");

    await GET(makeRequest());
    expect(activeStreamConnections.get("user-1")).toBe(1);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(activeStreamConnections.has("user-1")).toBe(false);
  });

  it("releases the connection slot when the stream reader is canceled", async () => {
    const { GET } = await import("@/app/api/stream/route");

    const res = await GET(makeRequest());
    const reader = res.body?.getReader();

    expect(activeStreamConnections.get("user-1")).toBe(1);

    await reader?.cancel();

    expect(activeStreamConnections.has("user-1")).toBe(false);
  });

  // ── response headers ──────────────────────────────────────────────────

  it("includes Cache-Control: no-cache header", async () => {
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
  });

  it("includes Connection: keep-alive header", async () => {
    const { GET } = await import("@/app/api/stream/route");
    const res = await GET(makeRequest());
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });
});
