import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isStateChangingMethod,
  isCsrfExempt,
  validateCsrf,
} from "../src/lib/csrf";

function makeRequest(
  headers: Record<string, string> = {}
): Parameters<typeof validateCsrf>[0] {
  return {
    headers: {
      get: (name: string) => {
        const k = name.toLowerCase();
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === k) {
            return headers[key] ?? null;
          }
        }
        return null;
      },
    },
  } as unknown as Parameters<typeof validateCsrf>[0];
}

const ENV_KEYS = [
  "ALLOWED_ORIGINS",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
];

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("isStateChangingMethod", () => {
  it("returns true for POST/PUT/PATCH/DELETE", () => {
    expect(isStateChangingMethod("POST")).toBe(true);
    expect(isStateChangingMethod("PUT")).toBe(true);
    expect(isStateChangingMethod("PATCH")).toBe(true);
    expect(isStateChangingMethod("DELETE")).toBe(true);
  });

  it("returns false for GET/HEAD/OPTIONS and arbitrary methods", () => {
    expect(isStateChangingMethod("GET")).toBe(false);
    expect(isStateChangingMethod("HEAD")).toBe(false);
    expect(isStateChangingMethod("OPTIONS")).toBe(false);
    expect(isStateChangingMethod("TRACE")).toBe(false);
    expect(isStateChangingMethod("FOOBAR")).toBe(false);
    expect(isStateChangingMethod("")).toBe(false);
  });
});

describe("isCsrfExempt", () => {
  it("treats webhook routes as exempt", () => {
    expect(isCsrfExempt("/api/webhooks/github")).toBe(true);
    expect(isCsrfExempt("/api/webhooks/custom")).toBe(true);
    expect(isCsrfExempt("/api/webhooks/dispatch")).toBe(true);
    expect(isCsrfExempt("/api/webhooks/github/something")).toBe(true);
  });

  it("treats rate-limited API routes as exempt", () => {
    expect(isCsrfExempt("/api/metrics")).toBe(true);
    expect(isCsrfExempt("/api/metrics/activity")).toBe(true);
    expect(isCsrfExempt("/api/auth/signin")).toBe(true);
    expect(isCsrfExempt("/api/auth/callback")).toBe(true);
    expect(isCsrfExempt("/api/auth/callback/github")).toBe(true);
  });

  it("does not exempt ordinary API routes", () => {
    expect(isCsrfExempt("/api/goals")).toBe(false);
    expect(isCsrfExempt("/api/goals/123")).toBe(false);
    expect(isCsrfExempt("/api/user/settings")).toBe(false);
    expect(isCsrfExempt("/api/streak/freeze")).toBe(false);
    expect(isCsrfExempt("/")).toBe(false);
  });
});

describe("validateCsrf", () => {
  beforeEach(() => {
    clearEnv();
  });

  afterEach(() => {
    clearEnv();
  });

  it("allows when neither origin nor referer is set", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const req = makeRequest({});
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("allows when the origin exactly matches an allowed origin", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const req = makeRequest({ origin: "https://app.example.com" });
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("rejects when the origin does not match an allowed origin", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const req = makeRequest({ origin: "https://attacker.example.com" });
    expect(validateCsrf(req)).toEqual({ valid: false, reason: "Forbidden" });
  });

  it("rejects when only the host prefix matches but the path is hostile", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const req = makeRequest({
      origin: "https://app.example.com.evil.test",
    });
    expect(validateCsrf(req)).toEqual({ valid: false, reason: "Forbidden" });
  });

  it("allows when the origin shares a prefix with an allowed origin (sub-path)", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const req = makeRequest({
      origin: "https://app.example.com/callback",
    });
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("strips trailing slashes from configured origins before matching", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com/";
    const req = makeRequest({ origin: "https://app.example.com" });
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("falls back to referer when origin is missing and referer matches", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const req = makeRequest({ referer: "https://app.example.com/some/page" });
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("rejects when origin is missing and referer does not match", () => {
    process.env.ALLOWED_ORIGINS = "https://app.example.com";
    const req = makeRequest({ referer: "https://attacker.example.com/" });
    expect(validateCsrf(req)).toEqual({ valid: false, reason: "Forbidden" });
  });

  it("treats the request as open when no allowed origins are configured", () => {
    // NODE_ENV is read-only on the type level; do not write to it.
    // Production-style is the default behaviour since no env vars are set.
    const req = makeRequest({ origin: "https://anything.test" });
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("adds NEXTAUTH_URL to the allowed origins", () => {
    process.env.NEXTAUTH_URL = "https://nextauth.example.com";
    const req = makeRequest({ origin: "https://nextauth.example.com" });
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("adds NEXT_PUBLIC_APP_URL to the allowed origins", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    const req = makeRequest({ origin: "https://app.example.com" });
    expect(validateCsrf(req)).toEqual({ valid: true });
  });

  it("merges ALLOWED_ORIGINS with NEXTAUTH_URL and NEXT_PUBLIC_APP_URL", () => {
    process.env.ALLOWED_ORIGINS = "https://a.example.com,https://b.example.com";
    process.env.NEXTAUTH_URL = "https://nextauth.example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";

    const ra = makeRequest({ origin: "https://a.example.com" });
    const rb = makeRequest({ origin: "https://b.example.com" });
    const rn = makeRequest({ origin: "https://nextauth.example.com" });
    const rp = makeRequest({ origin: "https://app.example.com" });
    const rx = makeRequest({ origin: "https://attacker.example.com" });

    expect(validateCsrf(ra)).toEqual({ valid: true });
    expect(validateCsrf(rb)).toEqual({ valid: true });
    expect(validateCsrf(rn)).toEqual({ valid: true });
    expect(validateCsrf(rp)).toEqual({ valid: true });
    expect(validateCsrf(rx)).toEqual({ valid: false, reason: "Forbidden" });
  });
});
