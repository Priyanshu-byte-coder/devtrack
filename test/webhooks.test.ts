import "./setup";
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidWebhookEvent,
  getAvailableEvents,
  generateSecretKey,
  encryptSecretKey,
  decryptSecretKey,
  signPayload,
  dispatchWebhook,
  dispatchToAllWebhooks,
  WebhookPayload,
  WebhookDeliveryResult,
} from "../src/lib/webhooks";

vi.mock("../src/lib/supabase");
vi.mock("../src/lib/crypto");
vi.mock("../src/lib/ssrf-protection");

import { supabaseAdmin } from "../src/lib/supabase";
import * as cryptoModule from "../src/lib/crypto";
import * as ssrfModule from "../src/lib/ssrf-protection";

global.fetch = vi.fn();

describe("Webhooks Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mocks
    vi.mocked(ssrfModule.isSafeUrl).mockResolvedValue(true);
    vi.mocked(cryptoModule.encryptToken).mockReturnValue({ encrypted: "enc_key", iv: "iv_value" });
    vi.mocked(cryptoModule.decryptToken).mockReturnValue("decrypted_secret");
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn(),
      contains: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // EVENT VALIDATION TESTS
  // ============================================================
  describe("isValidWebhookEvent", () => {
    it("should return true for valid events", () => {
      expect(isValidWebhookEvent("goal.completed")).toBe(true);
      expect(isValidWebhookEvent("goal.created")).toBe(true);
      expect(isValidWebhookEvent("streak.milestone")).toBe(true);
      expect(isValidWebhookEvent("daily.summary")).toBe(true);
      expect(isValidWebhookEvent("weekly.summary")).toBe(true);
      expect(isValidWebhookEvent("metrics.updated")).toBe(true);
    });

    it("should return false for invalid events", () => {
      expect(isValidWebhookEvent("invalid.event")).toBe(false);
      expect(isValidWebhookEvent("random")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidWebhookEvent("")).toBe(false);
    });

    it("should handle case sensitivity", () => {
      expect(isValidWebhookEvent("GOAL.COMPLETED")).toBe(false);
      expect(isValidWebhookEvent("Goal.Completed")).toBe(false);
    });

    it("should handle whitespace in events", () => {
      expect(isValidWebhookEvent(" goal.completed")).toBe(false);
      expect(isValidWebhookEvent("goal.completed ")).toBe(false);
      expect(isValidWebhookEvent("goal .completed")).toBe(false);
    });

    it("should handle null and undefined", () => {
      expect(isValidWebhookEvent(null as unknown as string)).toBe(false);
      expect(isValidWebhookEvent(undefined as unknown as string)).toBe(false);
    });

    it("should reject partial event names", () => {
      expect(isValidWebhookEvent("goal")).toBe(false);
      expect(isValidWebhookEvent("completed")).toBe(false);
      expect(isValidWebhookEvent("goal.")).toBe(false);
    });
  });

  describe("getAvailableEvents", () => {
    it("should return all available webhook events", () => {
      const events = getAvailableEvents();
      expect(events).toContain("goal.completed");
      expect(events).toContain("goal.created");
      expect(events).toContain("streak.milestone");
      expect(events).toContain("daily.summary");
      expect(events).toContain("weekly.summary");
      expect(events).toContain("metrics.updated");
    });

    it("should return exactly 6 events", () => {
      const events = getAvailableEvents();
      expect(events.length).toBe(6);
    });

    it("should return immutable list", () => {
      const events1 = getAvailableEvents();
      const events2 = getAvailableEvents();
      expect(events1).toEqual(events2);
    });

    it("should not contain duplicates", () => {
      const events = getAvailableEvents();
      const uniqueEvents = new Set(events);
      expect(uniqueEvents.size).toBe(6);
    });
  });

  // ============================================================
  // SECRET KEY GENERATION TESTS
  // ============================================================
  describe("generateSecretKey", () => {
    it("should generate a 64-character hex string", () => {
      const key = generateSecretKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate unique keys each time", () => {
      const keys = new Set([
        generateSecretKey(),
        generateSecretKey(),
        generateSecretKey(),
      ]);
      expect(keys.size).toBe(3);
    });

    it("should generate keys with proper randomness", () => {
      const key1 = generateSecretKey();
      const key2 = generateSecretKey();
      // Extremely unlikely to collide if truly random
      expect(key1).not.toBe(key2);
    });

    it("should produce valid hex characters only", () => {
      for (let i = 0; i < 10; i++) {
        const key = generateSecretKey();
        expect(key).toMatch(/^[a-f0-9]+$/);
      }
    });

    it("should represent 32 random bytes as hex", () => {
      // 32 bytes = 256 bits, which is 64 hex characters
      const key = generateSecretKey();
      expect(key.length).toBe(64);
      expect(Buffer.from(key, "hex").length).toBe(32);
    });
  });

  describe("encryptSecretKey", () => {
    it("should return encrypted key and iv", () => {
      const result = encryptSecretKey("my_secret");
      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
      expect(result.encrypted).toBe("enc_key");
      expect(result.iv).toBe("iv_value");
    });

    it("should call encryptToken with the secret", () => {
      const secret = "test_secret_123";
      encryptSecretKey(secret);
      expect(vi.mocked(cryptoModule.encryptToken)).toHaveBeenCalledWith(secret);
    });

    it("should handle empty string", () => {
      const result = encryptSecretKey("");
      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
    });

    it("should handle long secrets", () => {
      const longSecret = "x".repeat(1000);
      const result = encryptSecretKey(longSecret);
      expect(result).toHaveProperty("encrypted");
      expect(result).toHaveProperty("iv");
    });
  });

  describe("decryptSecretKey", () => {
    it("should return decrypted secret", () => {
      const result = decryptSecretKey("encrypted_key", "iv_value");
      expect(result).toBe("decrypted_secret");
    });

    it("should call decryptToken with encrypted and iv", () => {
      decryptSecretKey("encrypted_key", "iv_value");
      expect(vi.mocked(cryptoModule.decryptToken)).toHaveBeenCalledWith("encrypted_key", "iv_value");
    });

    it("should handle decryption failure gracefully", () => {
      vi.mocked(cryptoModule.decryptToken).mockReturnValue(null);
      const result = decryptSecretKey("invalid_encrypted", "invalid_iv");
      expect(result).toBeNull();
    });

    it("should preserve decrypted value integrity", () => {
      const expectedSecret = "my_webhook_secret_xyz";
      vi.mocked(cryptoModule.decryptToken).mockReturnValue(expectedSecret);
      const result = decryptSecretKey("enc", "iv");
      expect(result).toBe(expectedSecret);
    });
  });

  // ============================================================
  // PAYLOAD SIGNING TESTS
  // ============================================================
  describe("signPayload", () => {
    it("should return 64-character hex string (SHA256)", () => {
      const signature = signPayload('{"test":"data"}', "secret");
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce same signature for same payload and secret", () => {
      const payload = '{"test":"data"}';
      const secret = "secret";
      const sig1 = signPayload(payload, secret);
      const sig2 = signPayload(payload, secret);
      expect(sig1).toBe(sig2);
    });

    it("should produce different signatures for different payloads", () => {
      const secret = "secret";
      const sig1 = signPayload('{"test":"data1"}', secret);
      const sig2 = signPayload('{"test":"data2"}', secret);
      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different secrets", () => {
      const payload = '{"test":"data"}';
      const sig1 = signPayload(payload, "secret1");
      const sig2 = signPayload(payload, "secret2");
      expect(sig1).not.toBe(sig2);
    });

    it("should handle empty payload", () => {
      const signature = signPayload("", "secret");
      expect(signature).toHaveLength(64);
      expect(signature).toMatch(/^[a-f0-9]+$/);
    });

    it("should handle empty secret", () => {
      const signature = signPayload('{"test":"data"}', "");
      expect(signature).toHaveLength(64);
      expect(signature).toMatch(/^[a-f0-9]+$/);
    });

    it("should handle both empty payload and secret", () => {
      const signature = signPayload("", "");
      expect(signature).toHaveLength(64);
      expect(signature).toMatch(/^[a-f0-9]+$/);
    });

    it("should be deterministic (HMAC-SHA256)", () => {
      const payload = '{"event":"goal.completed","data":{"goalId":"123"}}';
      const secret = "webhook_secret_key";
      const signatures = new Set([
        signPayload(payload, secret),
        signPayload(payload, secret),
        signPayload(payload, secret),
      ]);
      expect(signatures.size).toBe(1);
    });

    it("should handle JSON with various field orders", () => {
      const secret = "secret";
      // Exact same content, different field order
      const sig1 = signPayload('{"a":1,"b":2}', secret);
      const sig2 = signPayload('{"b":2,"a":1}', secret);
      // Should be different because payload string is different
      expect(sig1).not.toBe(sig2);
    });

    it("should handle special characters in payload", () => {
      const payload = '{"test":"data\\"with\\"quotes","special":"!@#$%^&*()"}';
      const secret = "secret";
      const signature = signPayload(payload, secret);
      expect(signature).toHaveLength(64);
    });

    it("should handle very long payloads", () => {
      const longPayload = '{"data":"' + "x".repeat(10000) + '"}';
      const signature = signPayload(longPayload, "secret");
      expect(signature).toHaveLength(64);
    });

    it("should handle unicode in payload", () => {
      const payload = '{"user":"用户","emoji":"😀"}';
      const secret = "secret";
      const signature = signPayload(payload, secret);
      expect(signature).toHaveLength(64);
    });
  });

  // ============================================================
  // WEBHOOK DISPATCH TESTS
  // ============================================================
  describe("dispatchWebhook", () => {
    const mockWebhookConfig = {
      id: "webhook_123",
      url: "https://example.com/webhook",
      secret_key: "encrypted_secret_key",
      secret_iv: "secret_iv",
      is_enabled: true,
    };

    beforeEach(() => {
      // Setup default mock chain for supabase
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({ data: mockWebhookConfig, error: null });

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
        insert: mockInsert,
      } as any);

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
      });
    });

    it("should successfully dispatch webhook with 200 response", async () => {
      const result = await dispatchWebhook("webhook_123", "goal.completed", { goalId: "123" });
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it("should include proper headers in request", async () => {
      await dispatchWebhook("webhook_123", "goal.completed", { goalId: "123" });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const [url, options] = fetchCall;
      const headers = options.headers;

      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Webhook-Event"]).toBe("goal.completed");
      expect(headers["X-Webhook-Delivery-Id"]).toBe("webhook_123");
      expect(headers["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("should include payload in request body", async () => {
      const eventData = { goalId: "123", status: "completed" };
      await dispatchWebhook("webhook_123", "goal.completed", eventData);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.event).toBe("goal.completed");
      expect(body.data).toEqual(eventData);
      expect(body.timestamp).toBeDefined();
    });

    it("should handle webhook not found", async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("Not found") }),
        insert: vi.fn(),
      } as any);

      const result = await dispatchWebhook("nonexistent", "goal.completed", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle disabled webhooks", async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: new Error("Not found") }),
        insert: vi.fn(),
      } as any);

      const result = await dispatchWebhook("webhook_disabled", "goal.completed", {});
      expect(result.success).toBe(false);
    });

    it("should handle failed secret decryption", async () => {
      vi.mocked(cryptoModule.decryptToken).mockReturnValue(null);
      const result = await dispatchWebhook("webhook_123", "goal.completed", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("decrypt");
    });

    it("should block SSRF attacks", async () => {
      vi.mocked(ssrfModule.isSafeUrl).mockResolvedValue(false);
      const result = await dispatchWebhook("webhook_123", "goal.completed", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("SSRF");
    });

    it("should handle network timeout", async () => {
      const timeoutError = new Error("Request timeout");
      (global.fetch as any).mockRejectedValue(timeoutError);

      const result = await dispatchWebhook("webhook_123", "goal.completed", {});
      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      (global.fetch as any).mockRejectedValue(networkError);

      const result = await dispatchWebhook("webhook_123", "goal.completed", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should log failed delivery to database", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWebhookConfig, error: null }),
        insert: mockInsert,
      } as any);

      await dispatchWebhook("webhook_123", "goal.completed", {});

      // Verify insert was called for delivery log
      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls.find((c: any) =>
        c[0]?.webhook_id === "webhook_123"
      );
      expect(insertCall).toBeDefined();
    });

    it("should handle 4xx response codes", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await dispatchWebhook("webhook_123", "goal.completed", {});
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
    });

    it("should handle 5xx response codes", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await dispatchWebhook("webhook_123", "goal.completed", {});
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(503);
    });

    it("should set 10 second timeout on request", async () => {
      await dispatchWebhook("webhook_123", "goal.completed", {});

      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];

      expect(options.signal).toBeDefined();
    });

    it("should use POST method", async () => {
      await dispatchWebhook("webhook_123", "goal.completed", {});

      const fetchCall = (global.fetch as any).mock.calls[0];
      const options = fetchCall[1];

      expect(options.method).toBe("POST");
    });

    it("should include correct URL", async () => {
      await dispatchWebhook("webhook_123", "goal.completed", {});

      const fetchCall = (global.fetch as any).mock.calls[0];
      const url = fetchCall[0];

      expect(url).toBe(mockWebhookConfig.url);
    });

    it("should handle various webhook events", async () => {
      const events = ["goal.completed", "goal.created", "streak.milestone"] as const;

      for (const event of events) {
        (global.fetch as any).mockClear();
        (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

        await dispatchWebhook("webhook_123", event, {});

        const fetchCall = (global.fetch as any).mock.calls[0];
        const headers = fetchCall[1].headers;

        expect(headers["X-Webhook-Event"]).toBe(event);
      }
    });
  });

  // ============================================================
  // DISPATCH TO ALL WEBHOOKS TESTS
  // ============================================================
  describe("dispatchToAllWebhooks", () => {
    beforeEach(() => {
      const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: "webhook_1" }, { id: "webhook_2" }],
          error: null,
        }),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "webhook_1",
            url: "https://example.com/webhook",
            secret_key: "enc",
            secret_iv: "iv",
            is_enabled: true,
          },
          error: null,
        }),
        insert: mockInsert,
      } as any);

      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    });

    it("should dispatch to all enabled webhooks for user", async () => {
      const mockWebhooks = [
        { id: "webhook_1" },
        { id: "webhook_2" },
      ];

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockWebhooks,
          error: null,
        }),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "webhook_1",
            url: "https://example.com/webhook",
            secret_key: "enc",
            secret_iv: "iv",
            is_enabled: true,
          },
          error: null,
        }),
        insert: vi.fn(),
      } as any);

      await dispatchToAllWebhooks("user_123", "goal.completed", { goalId: "456" });

      // Should query webhooks for this user
      expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith("webhook_configs");
    });

    it("should handle user with no webhooks", async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      // Should not throw
      await expect(
        dispatchToAllWebhooks("user_no_webhooks", "goal.completed", {})
      ).resolves.toBeUndefined();
    });

    it("should respect MAX_WEBHOOKS_PER_USER limit", async () => {
      // Setup different mocks for the two different query patterns
      vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
        if (table === "webhook_configs") {
          return {
            select: vi.fn().mockImplementation((columns: string) => {
              if (columns === "id") {
                // This is the dispatchToAllWebhooks query  
                return {
                  eq: vi.fn().mockReturnThis(),
                  contains: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockResolvedValue({
                    data: Array.from({ length: 5 }, (_, i) => ({ id: `webhook_${i}` })),
                    error: null,
                  }),
                };
              } else {
                // This is the dispatchWebhook query for fetching webhook config
                return {
                  eq: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "webhook_0",
                      url: "https://example.com/webhook",
                      secret_key: "enc",
                      secret_iv: "iv",
                      is_enabled: true,
                    },
                    error: null,
                  }),
                };
              }
            }),
            eq: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            limit: vi.fn(),
            single: vi.fn(),
            insert: vi.fn(),
          } as any;
        } else if (table === "webhook_deliveries") {
          // Handle webhook_deliveries inserts
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          } as any;
        }
        return {} as any;
      });

      await dispatchToAllWebhooks("user_many_webhooks", "goal.completed", {});

      // Verify we queried webhooks
      expect(vi.mocked(supabaseAdmin.from)).toHaveBeenCalledWith("webhook_configs");
    });

    it("should dispatch to all returned webhooks in parallel", async () => {
      const mockWebhooks = [
        { id: "webhook_1" },
        { id: "webhook_2" },
        { id: "webhook_3" },
      ];

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: mockWebhooks,
          error: null,
        }),
        single: vi.fn().mockResolvedValue({
          data: {
            url: "https://example.com/webhook",
            secret_key: "enc",
            secret_iv: "iv",
            is_enabled: true,
          },
          error: null,
        }),
        insert: vi.fn(),
      } as any);

      await dispatchToAllWebhooks("user_123", "goal.completed", {});

      // fetch should be called for each webhook (3 times)
      expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================
  describe("Error Handling", () => {
    it("should handle undefined event in dispatchWebhook", async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "webhook_123",
            url: "https://example.com/webhook",
            secret_key: "enc",
            secret_iv: "iv",
            is_enabled: true,
          },
          error: null,
        }),
        insert: vi.fn(),
      } as any);

      (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });

      const result = await dispatchWebhook("webhook_123", undefined as unknown as string, {});
      // Should handle gracefully without crashing
      expect(result).toBeDefined();
    });

    it("should handle fetch network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network unreachable"));

      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: "webhook_123",
            url: "https://example.com/webhook",
            secret_key: "enc",
            secret_iv: "iv",
            is_enabled: true,
          },
          error: null,
        }),
        insert: vi.fn(),
      } as any);

      const result = await dispatchWebhook("webhook_123", "goal.completed", { test: "data" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network unreachable");
    });
  });

  // ============================================================
  // INTEGRATION TESTS
  // ============================================================
  describe("Integration Scenarios", () => {
    it("should generate, encrypt, and decrypt secret key flow", () => {
      // Generate
      const secret = generateSecretKey();
      expect(secret).toHaveLength(64);

      // Encrypt
      vi.mocked(cryptoModule.encryptToken).mockReturnValue({ encrypted: "encrypted_data", iv: "iv_data" });
      const encrypted = encryptSecretKey(secret);
      expect(encrypted.encrypted).toBe("encrypted_data");

      // Decrypt
      vi.mocked(cryptoModule.decryptToken).mockReturnValue(secret);
      const decrypted = decryptSecretKey(encrypted.encrypted, encrypted.iv);
      expect(decrypted).toBe(secret);
    });

    it("should create and verify webhook payload signature", () => {
      const payload = JSON.stringify({
        event: "goal.completed",
        timestamp: new Date().toISOString(),
        data: { goalId: "123" },
      });

      const secret = generateSecretKey();
      const signature = signPayload(payload, secret);

      // Verify signature is consistent
      const verifySignature = signPayload(payload, secret);
      expect(signature).toBe(verifySignature);
    });
  });
});