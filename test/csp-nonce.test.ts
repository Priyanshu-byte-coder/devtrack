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
it("serves signed-out views of public pages from a separately keyed CDN copy", async () => {
  const res = await proxy(new NextRequest("http://localhost/u/octocat"));
  const rewrite = new URL(res.headers.get("x-middleware-rewrite")!);
  expect(rewrite.pathname).toBe("/u/octocat");
  expect(rewrite.searchParams.get("_pub")).toBe("1");
  expect(res.headers.get("vercel-cdn-cache-control")).toContain("max-age=300");
  expect(res.headers.get("cache-control")).toBeNull();
  // The cached page keeps its CSP, nonce included.
  const nonce = res.headers.get("x-middleware-request-x-nonce");
  expect(res.headers.get("content-security-policy")).toContain(
    `'nonce-${nonce}'`
  );
});
