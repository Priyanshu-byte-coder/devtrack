export async function decryptTokenEdge(
  encrypted: string,
  iv: string
): Promise<string | null> {
  try {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      throw new Error("ENCRYPTION_KEY env var must be a 32-byte hex string");
    }

    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(encrypted) || encrypted.length % 2 !== 0) {
      throw new Error("Invalid encrypted token hex string");
    }
    if (!hexRegex.test(iv) || iv.length !== 24) {
      throw new Error("Encrypted token IV must be a 12-byte hex string");
    }

    const hexToBytes = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        const val = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        if (Number.isNaN(val)) {
          throw new Error("Invalid hex character in hex string");
        }
        bytes[i] = val;
      }
      return bytes;
    };

    const keyBytes = hexToBytes(keyHex);
    const ivBytes = hexToBytes(iv);
    const encryptedBytes = hexToBytes(encrypted);

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
        tagLength: 128
      },
      cryptoKey,
      encryptedBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Token decryption on Edge failed:", message);
    return null;
  }
}
