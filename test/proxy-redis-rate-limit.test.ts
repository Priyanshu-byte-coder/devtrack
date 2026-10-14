import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn().mockResolvedValue({ githubId: "101" }),
}));
import { proxy } from "@/proxy";
beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://dummy.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "dummy-private-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("honors a shared Redis denial using a valid REST EVAL command", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(Response.json({ result: [0, 5000] }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await proxy(
    new NextRequest("http://localhost/api/metrics/activity")
  );
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  expect(JSON.stringify(await response.json())).not.toContain(
    "dummy-private-token"
  );
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://dummy.upstash.io");
  const command = JSON.parse(options.body);
  expect(command[0]).toBe("EVAL");
  expect(command[2]).toBe(1);
  expect(command[3]).toBe("metrics-rate-limit:user:101");
  expect(options.signal).toBeInstanceOf(AbortSignal);
});
it("falls back to the local limiter when Redis returns an invalid command result", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ error: "ERR invalid result" }))
  );
  expect(
    (await proxy(new NextRequest("http://localhost/api/metrics/activity")))
      .status
  ).toBe(200);
});
