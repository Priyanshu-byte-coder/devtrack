import { it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("next-auth/jwt", () => ({ getToken: vi.fn().mockResolvedValue(null) }));
import { proxy } from "@/proxy";
it("forwards a fresh nonce to rendering and excludes unsafe production script policies", async () => {
  const first = await proxy(new NextRequest("http://localhost/"));
  const second = await proxy(new NextRequest("http://localhost/"));
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
