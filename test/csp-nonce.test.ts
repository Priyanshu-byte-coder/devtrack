import { it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn().mockResolvedValue(null) }));
import { proxy } from "@/proxy";
// A session cookie: signed-in views stay per-request and uncached.
const signedIn = () =>
  new NextRequest("http://localhost/", {
    headers: { cookie: "next-auth.session-token=abc" },
  });
it("forwards a fresh nonce to rendering and excludes unsafe production script policies", async () => {
  const first = await proxy(signedIn());
  const second = await proxy(signedIn());
  const csp = first.headers.get("content-security-policy")!;
  const nonce = first.headers.get("x-middleware-request-x-nonce");
  expect(nonce).toBeTruthy();
  expect(csp).toContain(`'nonce-${nonce}'`);
  expect(second.headers.get("x-middleware-request-x-nonce")).not.toBe(nonce);
  const script = csp
    .split(";")
    .find((value) => value.trim().startsWith("script-src"))!;
  expect(script).not.toContain("unsafe-inline");
  expect(script).not.toContain("unsafe-eval");
  expect(csp).toContain("worker-src 'self' blob:");
  expect(first.headers.get("cache-control")).toBe("private, no-store");
});
it("sends signed-out views of public pages to the cacheable copy", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  const res = await proxy(
    new NextRequest("http://localhost/leaderboard?period=week")
  );
  const rewrite = new URL(res.headers.get("x-middleware-rewrite")!);
  expect(rewrite.pathname).toBe("/api/public-page");
  expect(rewrite.searchParams.get("src")).toBe("/leaderboard?period=week");
  expect(res.headers.get("cache-control")).toBeNull();
  vi.unstubAllEnvs();
});
it("renders public pages per request outside production", async () => {
  const res = await proxy(new NextRequest("http://localhost/leaderboard"));
  expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  expect(res.headers.get("cache-control")).toBe("private, no-store");
});
it("redirects a profile URL with uppercase letters to its lowercase form", async () => {
  const res = await proxy(
    new NextRequest("http://localhost/u/Neal006?tab=stats")
  );
  expect(res.status).toBe(308);
  expect(new URL(res.headers.get("location")!).pathname).toBe("/u/neal006");
  expect(new URL(res.headers.get("location")!).search).toBe("?tab=stats");
});
