import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/metrics/contributions/hourly/route";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isMetricsCacheBypassed: vi.fn(() => false),
  metricsCacheKey: vi.fn(() => "test-cache-key"),
  withMetricsCache: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getServerSession: mocks.getServerSession,
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: mocks.isMetricsCacheBypassed,
  METRICS_CACHE_TTL_SECONDS: { contributions: 3600 },
  metricsCacheKey: mocks.metricsCacheKey,
  withMetricsCache: mocks.withMetricsCache,
}));

vi.stubGlobal("fetch", mocks.fetch);

function makeRequest(days?: string): NextRequest {
  const url =
    days === undefined
      ? "http://localhost/api/metrics/contributions/hourly"
      : `http://localhost/api/metrics/contributions/hourly?days=${encodeURIComponent(days)}`;
  return new NextRequest(url);
}

function authedSession() {
  mocks.getServerSession.mockResolvedValue({
    accessToken: "gh-token",
    githubLogin: "alice",
    githubId: "12345",
  });
}

describe("GET /api/metrics/contributions/hourly — days validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedSession();
    mocks.withMetricsCache.mockImplementation(async (_opts, fn) => fn());
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total_count: 0 }),
    });
  });

  it.each([
    ["-30", 1],
    ["1.5", 1],
    ["0", 1],
    ["Infinity", 30],
    ["999999", 365],
  ])("clamps days=%s to %i", async (daysParam, expectedDays) => {
    const res = await GET(makeRequest(daysParam));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ days: expectedDays });
    expect(mocks.fetch).toHaveBeenCalled();
  });

  it("defaults to 30 days when the parameter is missing", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ days: 30 });
  });

  it("uses a valid author-date in the GitHub search URL for unbounded input", async () => {
    const res = await GET(makeRequest("Infinity"));

    expect(res.status).toBe(200);
    const fetchUrl = decodeURIComponent(
      String(mocks.fetch.mock.calls[0]?.[0] ?? "")
    );
    const match = fetchUrl.match(/author-date:>=(\d{4}-\d{2}-\d{2})/);
    expect(match).not.toBeNull();
    expect(new Date(match![1]).toString()).not.toBe("Invalid Date");
  });
});
