import crypto from "crypto";

/**
 * Validates the HMAC-SHA256 signature sent by GitHub in the X-Hub-Signature-256 header.
 */
export function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const calculatedBuffer = Buffer.from(calculatedSignature, "hex");

    if (expectedBuffer.length !== calculatedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
  } catch {
    return false;
  }
}
