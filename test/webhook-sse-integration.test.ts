import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  sendSSEEvent: vi.fn(),
  verifyGitHubSignature: vi.fn(),
  revalidatePath: vi.fn(),
  invalidateUserMetricsCache: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: { from: mocks.supabaseFrom },
}));

vi.mock("@/lib/crypto", () => ({
  verifyGitHubSignature: mocks.verifyGitHubSignature,
  getExpectedSignature: vi.fn(),
  safeCompare: vi.fn(),
}));

vi.mock("@/lib/sse", () => ({
  sendSSEEvent: mocks.sendSSEEvent,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/metrics-cache", () => ({
  invalidateUserMetricsCache: mocks.invalidateUserMetricsCache,
}));

vi.mock("@/lib/error-handler", () => ({
  logError: mocks.logError,
}));

function makePushRequest(overrides: Record<string, unknown> = {}) {
  const body = JSON.stringify({
    sender: { login: "alice-dev" },
    pusher: { name: "alice-dev" },
    repository: { full_name: "alice-dev/my-repo" },
    commits: [{ id: "abc123" }],
    ...overrides,
  });

  const headers = new Headers({
    "x-hub-signature-256": "sha256=fakesig",
    "x-github-event": "push",
    "x-github-delivery": `delivery-${Date.now()}-${Math.random()}`,
    "content-type": "application/json",
  });

  return new Request("http://localhost/api/webhooks/github", {
    method: "POST",
    headers,
    body,
  });
}

function setupUserQuery(githubLogin: string, resolvedUserId: string) {
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  mocks.supabaseFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        update: vi.fn().mockReturnValue({
          ...updateChain,
          maybeSingle: updateChain.maybeSingle,
        }),
      };
    }
    return { select: vi.fn().mockReturnThis() };
  });

  updateChain.maybeSingle.mockResolvedValue({
    data: { id: resolvedUserId, github_id: "gh-123" },
    error: null,
  });

  return updateChain;
}

describe("GitHub webhook → SSE UUID resolution (issue #3129)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T12:00:00Z"));

    process.env.GITHUB_WEBHOOK_SECRET = "test-secret";

    mocks.verifyGitHubSignature.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it("resolves githubLogin to database UUID before calling sendSSEEvent", async () => {
    const resolvedUserId = "uuid-abc-123-def";
    setupUserQuery("alice-dev", resolvedUserId);

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    await POST(makePushRequest() as any);

    expect(mocks.sendSSEEvent).toHaveBeenCalledTimes(1);
    expect(mocks.sendSSEEvent).toHaveBeenCalledWith(
      resolvedUserId,
      "commit",
      expect.objectContaining({
        repo: "alice-dev/my-repo",
      })
    );
  });

  it("does NOT pass the raw githubLogin string to sendSSEEvent", async () => {
    const resolvedUserId = "uuid-abc-123-def";
    setupUserQuery("alice-dev", resolvedUserId);

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    await POST(makePushRequest() as any);

    const sentUserId = mocks.sendSSEEvent.mock.calls[0][0];
    expect(sentUserId).not.toBe("alice-dev");
  });

  it("does not call sendSSEEvent when user lookup returns null", async () => {
    const updateChain = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          update: vi.fn().mockReturnValue({
            ...updateChain,
            maybeSingle: updateChain.maybeSingle,
          }),
        };
      }
      // linked account query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      };
    });

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    await POST(makePushRequest() as any);

    expect(mocks.sendSSEEvent).not.toHaveBeenCalled();
  });

  it("falls back to linked account UUID when primary user not found", async () => {
    const linkedUserId = "uuid-linked-456";

    // Primary users query → not found
    const primaryUpdateChain = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    // Linked account query → found
    const linkedSelectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { user_id: linkedUserId, github_id: "gh-linked" },
        error: null,
      }),
    };

    mocks.supabaseFrom.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          update: vi.fn().mockReturnValue({
            ...primaryUpdateChain,
            maybeSingle: primaryUpdateChain.maybeSingle,
          }),
        };
      }
      if (table === "user_github_accounts") {
        return { select: vi.fn().mockReturnValue(linkedSelectChain) };
      }
      return { update: vi.fn().mockReturnThis() };
    });

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    await POST(makePushRequest() as any);

    expect(mocks.sendSSEEvent).toHaveBeenCalledWith(
      linkedUserId,
      "commit",
      expect.any(Object)
    );
  });

  it("includes repo name and timestamp in SSE payload", async () => {
    setupUserQuery("alice-dev", "uuid-abc-123-def");

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    await POST(makePushRequest() as any);

    const payload = mocks.sendSSEEvent.mock.calls[0][2];
    expect(payload).toEqual({
      repo: "alice-dev/my-repo",
      timestamp: "2026-07-25T12:00:00.000Z",
    });
  });

  it("rejects push events when webhook secret is not configured", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    const res = await POST(makePushRequest() as any);

    expect(res.status).toBe(500);
    expect(mocks.sendSSEEvent).not.toHaveBeenCalled();
  });

  it("rejects push events with invalid signature", async () => {
    mocks.verifyGitHubSignature.mockReturnValue(false);

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    const res = await POST(makePushRequest() as any);

    expect(res.status).toBe(401);
    expect(mocks.sendSSEEvent).not.toHaveBeenCalled();
  });

  it("returns 200 for non-push events without calling sendSSEEvent", async () => {
    setupUserQuery("alice-dev", "uuid-abc-123-def");

    const body = JSON.stringify({
      sender: { login: "alice-dev" },
      repository: { full_name: "alice-dev/my-repo" },
    });

    const headers = new Headers({
      "x-hub-signature-256": "sha256=fakesig",
      "x-github-event": "pull_request",
      "x-github-delivery": `delivery-${Date.now()}`,
      "content-type": "application/json",
    });

    const req = new Request("http://localhost/api/webhooks/github", {
      method: "POST",
      headers,
      body,
    });

    const { POST } = await import(
      "@/app/api/webhooks/github/route"
    );
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    expect(mocks.sendSSEEvent).not.toHaveBeenCalled();
  });
});
