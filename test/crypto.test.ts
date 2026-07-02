import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  safeCompare,
  getExpectedSignature,
  verifyGitHubSignature,
} from "../src/lib/crypto";

const VALID_KEY = "0".repeat(64);
const WEBHOOK_SECRET = "test-webhook-secret";

describe("crypto", () => {
  describe("encryptToken", () => {
    beforeEach(() => { process.env.ENCRYPTION_KEY = VALID_KEY; });
    afterEach(() => { delete process.env.ENCRYPTION_KEY; });
    it("returns an object with encrypted and iv properties", () => {
      const result = encryptToken("hello world");
      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
    });
    it("encrypted is a hex string", () => {
      expect(encryptToken("hello world").encrypted).toMatch(/^[0-9a-f]+$/);
    });
    it("iv is a 24-character hex string", () => {
      expect(encryptToken("hello world").iv).toMatch(/^[0-9a-f]{24}$/);
    });
    it("different calls produce different IVs", () => {
      expect(encryptToken("same text").iv).not.toBe(encryptToken("same text").iv);
    });
    it("throws for missing ENCRYPTION_KEY", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptToken("plaintext")).toThrow();
    });
    it("throws for invalid ENCRYPTION_KEY", () => {
      process.env.ENCRYPTION_KEY = "gg".repeat(32);
      expect(() => encryptToken("plaintext")).toThrow();
    });
  });
  describe("decryptToken", () => {
    beforeEach(() => { process.env.ENCRYPTION_KEY = VALID_KEY; });
    afterEach(() => { delete process.env.ENCRYPTION_KEY; });
    it("round-trips encrypt then decrypt", () => {
      const { encrypted, iv } = encryptToken("my-super-secret-token-123!");
      expect(decryptToken(encrypted, iv)).toBe("my-super-secret-token-123!");
    });
    it("returns null for tampered ciphertext", () => {
      const { encrypted, iv } = encryptToken("original text");
      expect(decryptToken(encrypted.slice(0, -2) + "ff", iv)).toBeNull();
    });
    it("returns null for wrong IV", () => {
      const { encrypted } = encryptToken("text");
      expect(decryptToken(encrypted, "a".repeat(24))).toBeNull();
    });
    it("returns null for IV that is not 12 bytes", () => {
      const { encrypted } = encryptToken("text");
      expect(decryptToken(encrypted, "a".repeat(20))).toBeNull();
    });
    it("returns null when ciphertext is too short", () => {
      expect(decryptToken("a".repeat(20), "b".repeat(24))).toBeNull();
    });
    it("throws for missing ENCRYPTION_KEY", () => {
      delete process.env.ENCRYPTION_KEY;
      const { encrypted, iv } = encryptToken("text");
      expect(() => decryptToken(encrypted, iv)).toThrow();
    });
    it("handles unicode plaintext correctly", () => {
      const { encrypted, iv } = encryptToken("token-with-unicode: \u00e9");
      expect(decryptToken(encrypted, iv)).toBe("token-with-unicode: \u00e9");
    });
    it("handles empty string plaintext", () => {
      const { encrypted, iv } = encryptToken("");
      expect(decryptToken(encrypted, iv)).toBe("");
    });
  });
  describe("safeCompare", () => {
    it("returns true for identical strings", () => { expect(safeCompare("hello", "hello")).toBe(true); });
    it("returns false for different length", () => { expect(safeCompare("hello", "hello!")).toBe(false); });
    it("returns false for same-length different content", () => { expect(safeCompare("hello", "world")).toBe(false); });
    it("returns true for empty strings", () => { expect(safeCompare("", "")).toBe(true); });
    it("handles unicode strings", () => {
      expect(safeCompare("caf\u00e9", "caf\u00e9")).toBe(true);
      expect(safeCompare("caf\u00e9", "tea")).toBe(false);
    });
  });
  describe("getExpectedSignature", () => {
    it("returns sha256= prefix", () => { expect(getExpectedSignature("s", "p").startsWith("sha256=")).toBe(true); });
    it("returns 71-char hex string", () => { expect(getExpectedSignature("s", "p")).toMatch(/^sha256=[0-9a-f]{64}$/); });
    it("same inputs produce same signature", () => { expect(getExpectedSignature("s", "b")).toBe(getExpectedSignature("s", "b")); });
    it("different bodies produce different signatures", () => { expect(getExpectedSignature("s", "b1")).not.toBe(getExpectedSignature("s", "b2")); });
    it("different secrets produce different signatures", () => { expect(getExpectedSignature("s1", "b")).not.toBe(getExpectedSignature("s2", "b")); });
  });
  describe("verifyGitHubSignature", () => {
    it("returns true for valid signature", () => {
      const sig = getExpectedSignature("s", '{"a":"b"}');
      expect(verifyGitHubSignature('{"a":"b"}', sig, "s")).toBe(true);
    });
    it("returns false for invalid signature", () => {
      expect(verifyGitHubSignature("b", "sha256=" + "a".repeat(64), "s")).toBe(false);
    });
    it("returns false for null signature", () => { expect(verifyGitHubSignature("b", null, "s")).toBe(false); });
    it("returns false without sha256= prefix", () => {
      const sig = getExpectedSignature("s", "b");
      expect(verifyGitHubSignature("b", sig.replace("sha256=", ""), "s")).toBe(false);
    });
    it("returns false for undefined signature", () => { expect(verifyGitHubSignature("b", undefined, "s")).toBe(false); });
  });
});