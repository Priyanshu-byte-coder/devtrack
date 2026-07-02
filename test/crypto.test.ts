import { describe, it, expect } from "vitest";
import {
  safeCompare,
  getExpectedSignature,
  verifyGitHubSignature,
} from "@/lib/crypto";

describe("safeCompare", () => {
  it("returns true for equal strings", () => {
    expect(safeCompare("hello", "hello")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(safeCompare("hello", "world")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(safeCompare("short", "much longer string")).toBe(false);
  });

  it("handles empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
    expect(safeCompare("", "a")).toBe(false);
    expect(safeCompare("a", "")).toBe(false);
  });

  it("handles unicode strings", () => {
    expect(safeCompare("hello", "hello")).toBe(true);
    expect(safeCompare("hello", "hellO")).toBe(false);
  });
});

describe("getExpectedSignature", () => {
  it("returns sha256= prefixed HMAC hex", () => {
    const sig = getExpectedSignature("secret", "body");
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("produces consistent signatures for same inputs", () => {
    const sig1 = getExpectedSignature("mysecret", "payload");
    const sig2 = getExpectedSignature("mysecret", "payload");
    expect(sig1).toBe(sig2);
  });

  it("produces different signatures for different secrets", () => {
    const sig1 = getExpectedSignature("secret1", "body");
    const sig2 = getExpectedSignature("secret2", "body");
    expect(sig1).not.toBe(sig2);
  });

  it("produces different signatures for different bodies", () => {
    const sig1 = getExpectedSignature("secret", "body1");
    const sig2 = getExpectedSignature("secret", "body2");
    expect(sig1).not.toBe(sig2);
  });
});

describe("verifyGitHubSignature", () => {
  it("returns true for valid signature", () => {
    const body = '{"action":"push"}';
    const secret = "webhook-secret";
    const sig = getExpectedSignature(secret, body);
    expect(verifyGitHubSignature(body, sig, secret)).toBe(true);
  });

  it("returns false for invalid signature", () => {
    const body = '{"action":"push"}';
    const secret = "webhook-secret";
    const wrongSig = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
    expect(verifyGitHubSignature(body, wrongSig, secret)).toBe(false);
  });

  it("returns false for signature without sha256= prefix", () => {
    const body = '{"action":"push"}';
    const secret = "webhook-secret";
    const sig = getExpectedSignature(secret, body).replace("sha256=", "");
    expect(verifyGitHubSignature(body, sig, secret)).toBe(false);
  });

  it("returns false for null signature", () => {
    expect(verifyGitHubSignature("body", null, "secret")).toBe(false);
  });

  it("returns false for empty string signature", () => {
    expect(verifyGitHubSignature("body", "", "secret")).toBe(false);
  });

  it("returns false for tampered body", () => {
    const originalBody = '{"action":"push"}';
    const tamperedBody = '{"action":"delete"}';
    const secret = "webhook-secret";
    const sig = getExpectedSignature(secret, originalBody);
    expect(verifyGitHubSignature(tamperedBody, sig, secret)).toBe(false);
  });

  it("returns false when secret does not match", () => {
    const body = '{"action":"push"}';
    const sig = getExpectedSignature("correct-secret", body);
    expect(verifyGitHubSignature(body, sig, "wrong-secret")).toBe(false);
  });
});
