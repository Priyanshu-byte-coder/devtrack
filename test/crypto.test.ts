import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  encryptToken,
  decryptToken,
  safeCompare,
  getExpectedSignature,
  verifyGitHubSignature,
} from "../src/lib/crypto";

const VALID_KEY = "0".repeat(64);
const WEBSOCKET_SECRET = "test-websocket-secret";

describe("crypto", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
    process.env.WEBSOCKET_SECRET = WEBSOCKET_SECRET;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.WEBSOCKET_SECRET;
  });

  describe("encryptToken", () => {
    it("returns an object with encrypted and iv properties", () => {
      const result = encryptToken("hello world");
      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
    });

    it("encrypted is a hex string", () => {
      const { encrypted } = encryptToken("hello world");
      expect(encrypted).toMatch(/^[0-9a-f]+$/);
    });

    it("iv is a 24-character hex string (12 bytes)", () => {
      const { iv } = encryptToken("hello world");
      expect(iv).toHaveLength(24);
      expect(iv).toMatch(/^[0-9a-f]{24}$/);
    });

    it("different calls produce different IVs", () => {
      const { iv: iv1 } = encryptToken("hello");
      const { iv: iv2 } = encryptToken("hello");
      expect(iv1).not.toBe(iv2);
    });

    it("throws for missing ENCRYPTION_KEY", () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encryptToken("test")).toThrow();
    });

    it("throws for ENCRYPTION_KEY that is not 64 hex chars", () => {
      process.env.ENCRYPTION_KEY = "not-valid";
      expect(() => encryptToken("test")).toThrow();
    });

    it("round-trips encrypt then decrypt and recovers original plaintext", () => {
      const plaintext = "sensitive data with unicode";
      const { encrypted, iv } = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted, iv);
      expect(decrypted).toBe(plaintext);
    });

    it("returns null for tampered ciphertext", () => {
      const { encrypted, iv } = encryptToken("hello");
      const tampered = encrypted.slice(0, -2) + "ff";
      expect(decryptToken(tampered, iv)).toBeNull();
    });

    it("returns null for wrong IV", () => {
      const { encrypted } = encryptToken("hello");
      const wrongIv = "a".repeat(24);
      expect(decryptToken(encrypted, wrongIv)).toBeNull();
    });

    it("returns null for IV that is not 12 bytes (24 hex chars)", () => {
      const { encrypted } = encryptToken("hello");
      const shortIv = "abcd";
      expect(decryptToken(encrypted, shortIv)).toBeNull();
    });

    it("returns null when ciphertext is too short", () => {
      const short = "aabbccdd";
      const iv = "a".repeat(24);
      expect(decryptToken(short, iv)).toBeNull();
    });

    it("handles unicode plaintext correctly", () => {
      const plaintext = "cafe resume test";
      const { encrypted, iv } = encryptToken(plaintext);
      const decrypted = decryptToken(encrypted, iv);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("decryptToken", () => {
    it("decrypts correctly with valid inputs", () => {
      const { encrypted, iv } = encryptToken("decrypt me");
      expect(decryptToken(encrypted, iv)).toBe("decrypt me");
    });

    it("returns null for invalid key", () => {
      const { encrypted, iv } = encryptToken("test");
      process.env.ENCRYPTION_KEY = "a".repeat(64);
      expect(decryptToken(encrypted, iv)).toBeNull();
    });

    it("returns null for missing ENCRYPTION_KEY", () => {
      delete process.env.ENCRYPTION_KEY;
      const { encrypted, iv } = encryptToken("test");
      expect(decryptToken(encrypted, iv)).toBeNull();
    });
  });

  describe("safeCompare", () => {
    it("returns true for equal strings", () => {
      expect(safeCompare("abc", "abc")).toBe(true);
    });

    it("returns false for different strings", () => {
      expect(safeCompare("abc", "abd")).toBe(false);
    });

    it("returns false for different length strings", () => {
      expect(safeCompare("short", "longer string")).toBe(false);
    });

    it("handles empty strings", () => {
      expect(safeCompare("", "")).toBe(true);
      expect(safeCompare("", "a")).toBe(false);
    });
  });

  describe("getExpectedSignature", () => {
    it("returns a sha256= prefixed string", () => {
      const sig = getExpectedSignature("secret", "body");
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it("produces consistent signatures for same input", () => {
      const sig1 = getExpectedSignature("secret", "body");
      const sig2 = getExpectedSignature("secret", "body");
      expect(sig1).toBe(sig2);
    });

    it("produces different signatures for different secrets", () => {
      const sig1 = getExpectedSignature("secret1", "body");
      const sig2 = getExpectedSignature("secret2", "body");
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
      expect(verifyGitHubSignature(body, "sha256=wrong", secret)).toBe(false);
    });

    it("returns false for null signature", () => {
      expect(verifyGitHubSignature("body", null, "secret")).toBe(false);
    });

    it("returns false for signature without sha256= prefix", () => {
      const body = "body";
      const sig = getExpectedSignature("secret", body);
      const badSig = sig.replace("sha256=", "");
      expect(verifyGitHubSignature(body, badSig, "secret")).toBe(false);
    });
  });
});
