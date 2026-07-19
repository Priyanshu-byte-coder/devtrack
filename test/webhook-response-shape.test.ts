import { vi, describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";

// Mock dependencies before importing the route
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(() => ({
              data: { id: "user-123", github_id: "456" },
              error: null,
            })),
          })),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/error-handler", () => ({
  logError: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({
  sendSSEEvent: vi.fn(),
}));

vi.mock("@/lib/metrics-cache", () => ({
  invalidateUserMetricsCache: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from "@/app/api/webhooks/github/route";

const WEBHOOK_SECRET = "test-webhook-secret-1234";

function signPayload(body: string): string {
  return `sha256=${crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")}`;
}

function createRequest(body: string, event = "push", signature?: string): Request {
  return new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": signature ?? signPayload(body),
      "x-github-event": event,
      "x-github-delivery": crypto.randomUUID(),
    },
    body,
  });
}

describe("webhook response shape — no internal data leakage", () => {
  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  const FORBIDDEN_FIELDS = [
    "githubId",
    "githubLogin",
    "accountType",
    "userMatched",
    "repository",
    "after",
    "commitCount",
    "reason",
  ];

  it("successful push response contains only { received: true }", async () => {
    const body = JSON.stringify({
      sender: { login: "testuser" },
      repository: { full_name: "testuser/repo" },
      commits: [{}],
      after: "abc123",
    });

    const res = await POST(createRequest(body) as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });

    for (const field of FORBIDDEN_FIELDS) {
      expect(json).not.toHaveProperty(field);
    }
  });

  it("non-push event response does not leak event type", async () => {
    const body = JSON.stringify({ action: "created" });

    const res = await POST(createRequest(body, "issues") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(json).not.toHaveProperty("event");
    expect(json).not.toHaveProperty("ignored");
  });

  it("missing actor response does not leak internal reason", async () => {
    const body = JSON.stringify({
      repository: { full_name: "org/repo" },
      commits: [{}],
    });

    const res = await POST(createRequest(body) as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ received: true });
    expect(json).not.toHaveProperty("reason");
    expect(json).not.toHaveProperty("userMatched");
  });
});
