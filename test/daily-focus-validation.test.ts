import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "@/app/api/daily-focus/route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

function makeRequest(
  url: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST"
): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("daily focus input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ githubId: "gh-123", githubLogin: "alice" });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });

    const single = vi.fn().mockResolvedValue({
      data: { id: "focus-1", goal_text: "Plan", date: "2026-07-17" },
      error: null,
    });
    mocks.upsert.mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    mocks.supabaseFrom.mockReturnValue({
      upsert: mocks.upsert,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
  });

  it("sanitizes a valid goal before saving", async () => {
    const response = await POST(
      makeRequest("/api/daily-focus", { goal_text: "<b>Plan</b>", date: "2026-07-17" })
    );

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", date: "2026-07-17", goal_text: "Plan" },
      { onConflict: "user_id,date" }
    );
  });

  it("rejects oversized or non-string goals", async () => {
    const oversized = await POST(
      makeRequest("/api/daily-focus", { goal_text: "a".repeat(281), date: "2026-07-17" })
    );
    const nonString = await POST(
      makeRequest("/api/daily-focus", { goal_text: 123, date: "2026-07-17" })
    );

    expect(oversized.status).toBe(400);
    expect(nonString.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects invalid calendar dates for POST, GET, and DELETE", async () => {
    const post = await POST(
      makeRequest("/api/daily-focus", { goal_text: "Plan", date: "2026-02-30" })
    );
    const get = await GET(makeRequest("/api/daily-focus?date=not-a-date"));
    const remove = await DELETE(makeRequest("/api/daily-focus?date=2026-13-01", undefined, "DELETE"));

    expect(post.status).toBe(400);
    expect(get.status).toBe(400);
    expect(remove.status).toBe(400);
    expect(mocks.supabaseFrom).not.toHaveBeenCalled();
  });
});
