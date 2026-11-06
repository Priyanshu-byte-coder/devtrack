import { beforeEach, it, expect, vi } from "vitest";
const metrics = vi.hoisted(() => ({
  contributions: vi.fn(),
  prs: vi.fn(),
  streak: vi.fn(),
  repos: vi.fn(),
}));
vi.mock("@/app/api/metrics/contributions/route", () => ({
  GET: metrics.contributions,
}));
vi.mock("@/app/api/metrics/prs/route", () => ({ GET: metrics.prs }));
vi.mock("@/app/api/metrics/streak/route", () => ({ GET: metrics.streak }));
vi.mock("@/app/api/metrics/repos/route", () => ({ GET: metrics.repos }));
import {
  loadInsightMetrics,
  InsightMetricsUnavailableError,
} from "@/lib/insight-metrics";
const request = () =>
  new Request("https://devtrack.example/api/ai-insights", {
    headers: { cookie: "next-auth.session-token=dummy" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  metrics.contributions.mockResolvedValue(
    Response.json({ data: {}, total: 0 })
  );
  metrics.prs.mockResolvedValue(Response.json({ open: 0, merged: 0 }));
  metrics.streak.mockResolvedValue(Response.json({ current: 0, longest: 0 }));
  metrics.repos.mockResolvedValue(Response.json({ repos: [] }));
});
it("calls authenticated handlers in-process and accepts valid zero activity", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  await expect(loadInsightMetrics(request())).resolves.toHaveLength(4);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(
    metrics.contributions.mock.calls[0][0].headers.get("cookie")
  ).toContain("session-token");
  fetchSpy.mockRestore();
});
it.each([{}, { data: {}, total: 2, complete: false }])(
  "rejects missing or partial metrics %#",
  async (body) => {
    metrics.contributions.mockResolvedValue(Response.json(body));
    await expect(loadInsightMetrics(request())).rejects.toBeInstanceOf(
      InsightMetricsUnavailableError
    );
  }
);
it("preserves upstream cooldown metadata", async () => {
  metrics.prs.mockResolvedValue(
    Response.json(
      { error: "quota" },
      { status: 429, headers: { "Retry-After": "90" } }
    )
  );
  try {
    await loadInsightMetrics(request());
    throw Error("Unexpected success");
  } catch (error) {
    expect(error).toBeInstanceOf(InsightMetricsUnavailableError);
    expect(
      (error as InsightMetricsUnavailableError).response.headers.get(
        "retry-after"
      )
    ).toBe("90");
  }
});
