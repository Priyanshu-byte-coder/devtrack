// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  resolveAppUser: vi.fn(),
  supabaseFrom: vi.fn(),
  dispatchWebhook: vi.fn(),
  isSafeUrl: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/resolve-user", () => ({ resolveAppUser: mocks.resolveAppUser }));
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));
vi.mock("@/lib/webhooks", () => ({
  dispatchWebhook: mocks.dispatchWebhook,
}));
vi.mock("@/lib/ssrf-protection", () => ({
  isSafeUrl: mocks.isSafeUrl,
}));

describe("POST /api/webhooks/custom/[id]/deliveries/[deliveryId]/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getServerSession.mockResolvedValue({
      githubId: "gh-1",
      githubLogin: "alice",
    });
    mocks.resolveAppUser.mockResolvedValue({ id: "user-1" });
    mocks.isSafeUrl.mockResolvedValue(true);
  });

  it("extracts the nested data from payload and passes it to dispatchWebhook", async () => {
    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "webhook_configs") {
        const selectMock = vi.fn().mockImplementation((selectString: string) => {
          const singleMock = vi.fn().mockImplementation(async () => {
            if (selectString.includes("url")) {
              return { data: { url: "https://example.com/webhook" }, error: null };
            }
            return { data: { id: "webhook-1", is_enabled: true }, error: null };
          });
          const eqMock2 = vi.fn().mockReturnValue({ single: singleMock });
          const eqMock1 = vi.fn().mockImplementation(() => {
            return {
              eq: eqMock2,
              single: singleMock,
            };
          });
          return { eq: eqMock1 };
        });
        return { select: selectMock };
      }

      if (table === "webhook_deliveries") {
        const selectMock = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "delivery-1",
                  webhook_id: "webhook-1",
                  event: "goal.completed",
                  payload: {
                    event: "goal.completed",
                    timestamp: "2026-01-01T00:00:00Z",
                    data: { goalId: "123", progress: 100 },
                  },
                },
                error: null,
              }),
            }),
          }),
        });
        return { select: selectMock };
      }

      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis() }) };
    });

    mocks.dispatchWebhook.mockResolvedValue({ success: true, statusCode: 200 });

    const { POST } = await import("@/app/api/webhooks/custom/[id]/deliveries/[deliveryId]/retry/route");
    const req = new NextRequest("http://localhost/api/webhooks/custom/webhook-1/deliveries/delivery-1/retry", {
      method: "POST",
    });

    const params = Promise.resolve({ id: "webhook-1", deliveryId: "delivery-1" });
    const res = await POST(req, { params });
    const resJson = await res.json();

    expect(res.status).toBe(200);
    expect(resJson.success).toBe(true);

    // Verify that dispatchWebhook was called with the inner nested data, NOT the full payload!
    expect(mocks.dispatchWebhook).toHaveBeenCalledWith(
      "webhook-1",
      "goal.completed",
      { goalId: "123", progress: 100 }
    );
  });
});
