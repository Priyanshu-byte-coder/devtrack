import { beforeEach, afterEach, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase-admin", () => ({ supabaseAdmin: { from: vi.fn() } }));
import { getWeeklyWebhookStats } from "@/lib/weekly-webhook-stats";
beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());
it("reads exact totals beyond the search pagination ceiling", async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      Response.json({ total_count: 2501, items: [], incomplete_results: false })
    )
    .mockResolvedValueOnce(
      Response.json({ total_count: 120, items: [], incomplete_results: false })
    );
  expect(await getWeeklyWebhookStats("u1", "alice", "dummy")).toEqual({
    commits: 2501,
    prs: 120,
  });
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
  expect(url.searchParams.get("per_page")).toBe("1");
  expect(url.searchParams.get("q")).toContain("author:alice");
});
it("does not convert upstream failures into zero activity", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ error: "unavailable" }, { status: 502 })
  );
  await expect(getWeeklyWebhookStats("u1", "alice", "dummy")).rejects.toThrow(
    "unavailable"
  );
});
it("rejects incomplete counts rather than sending a misleading summary", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ total_count: 12, incomplete_results: true })
  );
  await expect(getWeeklyWebhookStats("u1", "alice", "dummy")).rejects.toThrow(
    "incomplete"
  );
});
