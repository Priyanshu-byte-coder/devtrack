import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_ERROR_MESSAGE =
  "ENCRYPTION_KEY env var must be a 32-byte hex string";
const IV_ERROR_MESSAGE =
  "Encrypted token IV must be a 12-byte hex string";
const PAYLOAD_ERROR_MESSAGE =
  "Encrypted token payload must include at least a 16-byte auth tag";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(KEY_ERROR_MESSAGE);
  }

  const keyBuffer = Buffer.from(key, "hex");

  if (keyBuffer.length !== 32) {
    throw new Error(KEY_ERROR_MESSAGE);
  }

  return keyBuffer;
}

function assertFixedHex(value: string, expectedChars: number, message: string) {
  if (!new RegExp(`^[0-9a-fA-F]{${expectedChars}}$`).test(value)) {
    throw new Error(message);
  }
}

function validateEncryptedTokenPayload(encrypted: string, iv: string) {
  assertFixedHex(iv, IV_LENGTH * 2, IV_ERROR_MESSAGE);

  if (
    encrypted.length < AUTH_TAG_LENGTH * 2 ||
    encrypted.length % 2 !== 0 ||
    !/^[0-9a-fA-F]+$/.test(encrypted)
  ) {
    throw new Error(PAYLOAD_ERROR_MESSAGE);
  }
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param plaintext - The string to encrypt.
 * @returns An object containing the hex-encoded encrypted string and the initialization vector (IV).
 */
export function encryptToken(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString("hex"),
    iv: iv.toString("hex"),
  };
}

/**
 * Decrypts a hex-encoded string using AES-256-GCM.
 * @param encrypted - The encrypted token string.
 * @param iv - The initialization vector used during encryption.
 * @returns The decrypted plaintext string, or null if decryption fails.
 */
export function decryptToken(
  encrypted: string,
  iv: string
): string | null {
  try {
    const key = getEncryptionKey();
    validateEncryptedTokenPayload(encrypted, iv);
    const encryptedBuffer = Buffer.from(encrypted, "hex");
    const ivBuffer = Buffer.from(iv, "hex");

    if (ivBuffer.length !== IV_LENGTH) {
      throw new Error("Invalid IV length");
    }

    if (encryptedBuffer.length < AUTH_TAG_LENGTH + 1) {
      throw new Error("Encrypted token too short");
    }

    const ciphertext = encryptedBuffer.subarray(
      0,
      encryptedBuffer.length - AUTH_TAG_LENGTH
    );

    const authTag = encryptedBuffer.subarray(
      encryptedBuffer.length - AUTH_TAG_LENGTH
    );

    const decipher = createDecipheriv(ALGORITHM, key, ivBuffer);

    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    console.error("Token decryption failed:", error);
    return null;
  }
}

/**
 * Safely compares two strings to prevent timing attacks.
 * @param a - The first string.
 * @param b - The second string.
 * @returns True if the strings are strictly equal.
 */
export function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

/**
 * Generates an HMAC SHA-256 signature for a given payload body.
 * @param secret - The secret key for HMAC.
 * @param body - The payload body string.
 * @returns The generated signature prefixed with 'sha256='.
 */
export function getExpectedSignature(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/**
 * Verifies if a provided GitHub webhook signature matches the expected signature for a payload.
 * @param body - The raw payload body.
 * @param signature - The signature provided in the webhook headers.
 * @param secret - The expected webhook secret.
 * @returns True if the signature is valid.
 */
export function verifyGitHubSignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  return safeCompare(signature, getExpectedSignature(secret, body));
}



