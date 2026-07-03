import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptTokenEdge } from "@/lib/crypto-edge";

// A valid 32-byte hex string (64 hex chars)
const VALID_KEY = "a".repeat(64);

// Helper: encrypt plaintext using Web Crypto API so we have a valid ciphertext
async function encrypt(plaintext: string, keyHex: string): Promise<{ encrypted: string; iv: string }> {
  const hexToBytes = (hex: string) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  };

  const keyBytes = hexToBytes(keyHex);
  const ivBytes = globalThis.crypto.getRandomValues(new Uint8Array(12));

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes, tagLength: 128 },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );

  const encryptedHex = Buffer.from(new Uint8Array(encryptedBuffer)).toString("hex");
  const ivHex = Buffer.from(ivBytes).toString("hex");

  return { encrypted: encryptedHex, iv: ivHex };
}

describe("decryptTokenEdge", () => {
  let validCipher: { encrypted: string; iv: string };

  beforeAll(async () => {
    validCipher = await encrypt("my-secret-token", VALID_KEY);
  });

  beforeEach(() => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns null when ENCRYPTION_KEY is missing", async () => {
    delete process.env.ENCRYPTION_KEY;
    const result = await decryptTokenEdge(validCipher.encrypted, validCipher.iv);
    expect(result).toBeNull();
  });

  it("returns null when ENCRYPTION_KEY is wrong length", async () => {
    process.env.ENCRYPTION_KEY = "abc123";
    const result = await decryptTokenEdge(validCipher.encrypted, validCipher.iv);
    expect(result).toBeNull();
  });

  it("returns null when ENCRYPTION_KEY has non-hex characters", async () => {
    process.env.ENCRYPTION_KEY = "g".repeat(64);
    const result = await decryptTokenEdge(validCipher.encrypted, validCipher.iv);
    expect(result).toBeNull();
  });

  it("returns null when ENCRYPTION_KEY is too short", async () => {
    process.env.ENCRYPTION_KEY = "a".repeat(63);
    const result = await decryptTokenEdge(validCipher.encrypted, validCipher.iv);
    expect(result).toBeNull();
  });

  it("returns null when encrypted string contains non-hex characters", async () => {
    const result = await decryptTokenEdge("xyz".repeat(16), validCipher.iv);
    expect(result).toBeNull();
  });

  it("returns null when encrypted string has odd length", async () => {
    const result = await decryptTokenEdge("a".repeat(63), validCipher.iv);
    expect(result).toBeNull();
  });

  it("returns null when IV has wrong length (not 24 hex chars)", async () => {
    const result = await decryptTokenEdge(validCipher.encrypted, "a".repeat(20));
    expect(result).toBeNull();
  });

  it("returns null when IV contains non-hex characters", async () => {
    const result = await decryptTokenEdge(validCipher.encrypted, "xyz".repeat(6));
    expect(result).toBeNull();
  });

  it("returns null when ciphertext is tampered (wrong last byte)", async () => {
    const tampered = validCipher.encrypted.slice(0, -2) + "ff";
    const result = await decryptTokenEdge(tampered, validCipher.iv);
    expect(result).toBeNull();
  });

  it("returns the original plaintext on valid roundtrip", async () => {
    const result = await decryptTokenEdge(validCipher.encrypted, validCipher.iv);
    expect(result).toBe("my-secret-token");
  });

  it("handles unicode plaintext correctly", async () => {
    const unicodeCipher = await encrypt("token-with-unicode-\u4e2d\u6587-\uD83D\uDE00", VALID_KEY);
    const result = await decryptTokenEdge(unicodeCipher.encrypted, unicodeCipher.iv);
    expect(result).toBe("token-with-unicode-\u4e2d\u6587-\uD83D\uDE00");
  });

  it("handles empty string plaintext", async () => {
    const emptyCipher = await encrypt("", VALID_KEY);
    const result = await decryptTokenEdge(emptyCipher.encrypted, emptyCipher.iv);
    expect(result).toBe("");
  });

  it("handles long plaintext correctly", async () => {
    const longPlaintext = "x".repeat(10000);
    const longCipher = await encrypt(longPlaintext, VALID_KEY);
    const result = await decryptTokenEdge(longCipher.encrypted, longCipher.iv);
    expect(result).toBe(longPlaintext);
  });
});
