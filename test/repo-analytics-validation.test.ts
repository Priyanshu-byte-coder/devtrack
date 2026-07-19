import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseRepoParam } from "@/lib/repo-analytics-utils";
import { GET } from "@/app/api/metrics/repo-analytics/route";
import { NextRequest } from "next/server";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isMetricsCacheBypassed: vi.fn(() => false),
  metricsCacheKey: vi.fn(() => "test-cache-key"),
  withMetricsCache: vi.fn(),
  computeHealthScore: vi.fn(() => ({ score: 90, grade: "A", signals: {} })),
  fetch: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/metrics-cache", () => ({
  isMetricsCacheBypassed: mocks.isMetricsCacheBypassed,
  metricsCacheKey: mocks.metricsCacheKey,
  withMetricsCache: mocks.withMetricsCache,
}));
vi.mock("@/lib/repo-health", () => ({
  computeHealthScore: mocks.computeHealthScore,
}));

vi.stubGlobal("fetch", mocks.fetch);

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(repo?: string): NextRequest {
  const url = repo
    ? `http://localhost/api/metrics/repo-analytics?repo=${encodeURIComponent(repo)}`
    : "http://localhost/api/metrics/repo-analytics";
  return new NextRequest(url);
}

function authedSession() {
  mocks.getServerSession.mockResolvedValue({
    accessToken: "gh-token",
    githubLogin: "alice",
    githubId: "12345",
  });
}

// ─── unit tests: parseRepoParam ──────────────────────────────────────────────

describe("parseRepoParam — validation logic", () => {
  // ── valid inputs ───────────────────────────────────────────────────────────

  it("accepts a standard owner/repo", () => {
    const result = parseRepoParam("octocat/Hello-World");
    expect(result).toEqual({ owner: "octocat", repo: "Hello-World" });
  });

  it("accepts a single-char owner", () => {
    const result = parseRepoParam("a/b");
    expect(result).toEqual({ owner: "a", repo: "b" });
  });

  it("accepts dots and underscores in repo name", () => {
    const result = parseRepoParam("torvalds/linux-2.6");
    expect(result).toEqual({ owner: "torvalds", repo: "linux-2.6" });
  });

  it("accepts an org with hyphens", () => {
    const result = parseRepoParam("my-org/my-repo");
    expect(result).toEqual({ owner: "my-org", repo: "my-repo" });
  });

  it("accepts an owner at exactly 39 chars", () => {
    const owner = "a" + "b".repeat(37) + "c"; // 39 chars
    expect(owner.length).toBe(39);
    const result = parseRepoParam(`${owner}/repo`);
    expect(result).toEqual({ owner, repo: "repo" });
  });

  it("accepts a repo name at exactly 100 chars", () => {
    const repo = "r".repeat(100);
    const result = parseRepoParam(`owner/${repo}`);
    expect(result).toEqual({ owner: "owner", repo });
  });

  it("trims surrounding whitespace before validating", () => {
    const result = parseRepoParam("  octocat/Hello-World  ");
    expect(result).toEqual({ owner: "octocat", repo: "Hello-World" });
  });

  // ── rejection: missing segments ───────────────────────────────────────────

  it("rejects a value with no slash", () => {
    expect(parseRepoParam("just-a-name")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(parseRepoParam("")).toBeNull();
  });

  it("rejects whitespace-only input", () => {
    expect(parseRepoParam("   ")).toBeNull();
  });

  it("rejects a trailing slash with no repo", () => {
    expect(parseRepoParam("octocat/")).toBeNull();
  });

  it("rejects a leading slash with no owner", () => {
    expect(parseRepoParam("/Hello-World")).toBeNull();
  });

  // ── rejection: extra path segments (the reported issue) ───────────────────

  it("rejects three-segment path — regression for #1700", () => {
    expect(parseRepoParam("octocat/Hello-World/issues")).toBeNull();
  });

  it("rejects four-segment path", () => {
    expect(parseRepoParam("octocat/Hello-World/issues/123")).toBeNull();
  });

  it("rejects a path starting with extra slashes", () => {
    expect(parseRepoParam("//etc/passwd")).toBeNull();
  });

  // ── rejection: path traversal attempts ───────────────────────────────────

  it("rejects dot-dot traversal in the repo segment", () => {
    expect(parseRepoParam("owner/..")).toBeNull();
  });

  it("rejects single-dot repo name", () => {
    expect(parseRepoParam("owner/.")).toBeNull();
  });

  it("rejects classic path traversal pattern", () => {
    expect(parseRepoParam("../../../admin")).toBeNull();
  });

  // ── rejection: invalid characters ─────────────────────────────────────────

  it("rejects a space inside the value", () => {
    expect(parseRepoParam("octo cat/Hello-World")).toBeNull();
  });

  it("rejects special characters in owner", () => {
    expect(parseRepoParam("octo@cat/repo")).toBeNull();
  });

  it("rejects question marks (query confusion)", () => {
    expect(parseRepoParam("owner/repo?foo=bar")).toBeNull();
  });

  it("rejects a null byte", () => {
    expect(parseRepoParam("owner/repo\0extra")).toBeNull();
  });

  // ── rejection: length violations ──────────────────────────────────────────

  it("rejects an owner longer than 39 chars", () => {
    const owner = "a".repeat(40); // 40 chars — one over the limit
    expect(parseRepoParam(`${owner}/repo`)).toBeNull();
  });

  it("rejects a repo name longer than 100 chars", () => {
    const repo = "r".repeat(101);
    expect(parseRepoParam(`owner/${repo}`)).toBeNull();
  });

  // ── rejection: owner hyphen rules ─────────────────────────────────────────

  it("rejects an owner starting with a hyphen", () => {
    expect(parseRepoParam("-bad-owner/repo")).toBeNull();
  });

  it("rejects an owner ending with a hyphen", () => {
    expect(parseRepoParam("bad-owner-/repo")).toBeNull();
  });
});

// ─── integration tests: GET route ────────────────────────────────────────────

describe("GET /api/metrics/repo-analytics — validation integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authedSession();
  });

  // ── authentication ────────────────────────────────────────────────────────

  it("returns 401 when there is no session", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest("octocat/Hello-World"));
    expect(res.status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.withMetricsCache).not.toHaveBeenCalled();
  });

  // ── missing parameter ─────────────────────────────────────────────────────

  it("returns 400 when the repo parameter is absent", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing/i);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.withMetricsCache).not.toHaveBeenCalled();
  });

  // ── malformed values return 400 before any cache or fetch ────────────────

  it("returns 400 for extra path segments — regression for #1700", async () => {
    const res = await GET(makeRequest("octocat/Hello-World/issues"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.withMetricsCache).not.toHaveBeenCalled();
  });

  it("returns 400 for a bare repository name without an owner", async () => {
    const res = await GET(makeRequest("just-repo-name"));
    expect(res.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.withMetricsCache).not.toHaveBeenCalled();
  });

  it("returns 400 for a path-traversal attempt", async () => {
    const res = await GET(makeRequest("owner/.."));
    expect(res.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.withMetricsCache).not.toHaveBeenCalled();
  });

  it("returns 400 for an owner starting with a hyphen", async () => {
    const res = await GET(makeRequest("-org/repo"));
    expect(res.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 for special characters in the repo name", async () => {
    const res = await GET(makeRequest("owner/repo?extra=segment"));
    expect(res.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the repo value is whitespace only", async () => {
    // The URL-encoded space becomes %20 — after decoding it's " "
    const req = new NextRequest(
      "http://localhost/api/metrics/repo-analytics?repo=%20%20"
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  // ── valid repo proceeds to cache and fetch ────────────────────────────────

  it("reaches withMetricsCache for a valid owner/repo", async () => {
    mocks.withMetricsCache.mockResolvedValue({ overview: {}, contributors: [], timeline: [], health: {}, primaryStack: [], languageBreakdown: [] });
    const res = await GET(makeRequest("octocat/Hello-World"));
    expect(res.status).toBe(200);
    expect(mocks.withMetricsCache).toHaveBeenCalledOnce();
  });

  it("uses the validated repo in the cache key, not the raw input", async () => {
    mocks.withMetricsCache.mockResolvedValue({ overview: {}, contributors: [], timeline: [], health: {}, primaryStack: [], languageBreakdown: [] });
    await GET(makeRequest("  octocat/Hello-World  ")); // with whitespace
    // metricsCacheKey should be called with the trimmed form
    expect(mocks.metricsCacheKey).toHaveBeenCalledWith(
      expect.anything(),
      "repo-analytics-octocat/Hello-World",
      expect.anything()
    );
  });

  it("does not generate a cache entry for the invalid three-segment path", async () => {
    await GET(makeRequest("octocat/Hello-World/issues"));
    expect(mocks.metricsCacheKey).not.toHaveBeenCalled();
    expect(mocks.withMetricsCache).not.toHaveBeenCalled();
  });
});
