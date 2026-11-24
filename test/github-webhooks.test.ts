// @vitest-environment node
import { describe, expect, it } from "vitest";
import crypto from "crypto";
import { verifyGitHubWebhookSignature } from "../src/lib/webhook-signature";
import { broadcastMetricInvalidation, subscribeToMetricEvents } from "../src/lib/metric-events";

describe("GitHub Webhooks & Metric Events", () => {
  const secret = "test-secret-key-123";

  it("successfully verifies valid HMAC-SHA256 signatures", () => {
    const payload = JSON.stringify({ action: "push", sender: { login: "octocat" } });
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const signature = `sha256=${hmac.digest("hex")}`;

    const isValid = verifyGitHubWebhookSignature(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it("rejects invalid or tampered signatures", () => {
    const payload = JSON.stringify({ action: "push" });
    const isValid = verifyGitHubWebhookSignature(
      payload,
      "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      secret
    );
    expect(isValid).toBe(false);
  });

  it("rejects signatures missing the sha256= prefix", () => {
    const payload = "sample";
    const isValid = verifyGitHubWebhookSignature(payload, "invalid_header", secret);
    expect(isValid).toBe(false);
  });

  it("rejects null or empty signatures", () => {
    expect(verifyGitHubWebhookSignature("data", null, secret)).toBe(false);
    expect(verifyGitHubWebhookSignature("data", "", secret)).toBe(false);
  });

  it("broadcasts invalidation events to subscribers", () => {
    const received: Array<{ username: string; repo?: string }> = [];
    const unsubscribe = subscribeToMetricEvents((event) => {
      received.push(event);
    });

    broadcastMetricInvalidation("octocat", "awesome-repo");
    expect(received).toHaveLength(1);
    expect(received[0].username).toBe("octocat");
    expect(received[0].repo).toBe("awesome-repo");

    unsubscribe();
    broadcastMetricInvalidation("octocat", "another-repo");
    expect(received).toHaveLength(1); // No new events after unsubscribe
  });
});
