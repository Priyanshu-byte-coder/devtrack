import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  finish: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("@/lib/cron-batch", () => ({ claimCronBatch: mocks.claim }));
vi.mock("@/lib/gamification/persistence", () => ({
  captureGamification: mocks.capture,
}));

const SECRET = "test-cron-secret";
const request = (auth?: string) =>
  new Request("http://localhost/api/cron/gamification", {
    headers: auth ? { Authorization: auth } : {},
  });

describe("GET /api/cron/gamification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    mocks.claim.mockResolvedValue({ cursor: null, finish: mocks.finish });
    mocks.capture.mockResolvedValue({
      capturedOn: "2026-11-02",
      seasonClosed: null,
    });
  });

  it("rejects calls without the cron secret and does no work", async () => {
    const { GET } = await import("@/app/api/cron/gamification/route");
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret", async () => {
    const { GET } = await import("@/app/api/cron/gamification/route");
    const res = await GET(request("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("captures and releases the lease on success", async () => {
    const { GET } = await import("@/app/api/cron/gamification/route");
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ capturedOn: "2026-11-02" });
    expect(mocks.finish).toHaveBeenCalledWith(null);
  });

  it("skips when another run holds the lease", async () => {
    mocks.claim.mockResolvedValue(null);
    const { GET } = await import("@/app/api/cron/gamification/route");
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ skipped: true });
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("returns 500 and keeps the lease when capture fails", async () => {
    mocks.capture.mockRejectedValue(new Error("github down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/cron/gamification/route");
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(500);
    // The error text stays in the server log, not the response.
    expect(JSON.stringify(await res.json())).not.toContain("github down");
    expect(mocks.finish).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns 503 when the lease table is unreachable", async () => {
    mocks.claim.mockRejectedValue(new Error("db down"));
    const { GET } = await import("@/app/api/cron/gamification/route");
    const res = await GET(request(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
  });
});
