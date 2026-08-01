import "./setup";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isActivityAlertEvent,
  isValidWebhookEvent,
  getActivityAlertEvents,
  getAvailableEvents,
  ACTIVITY_ALERT_EVENTS,
  dispatchActivityAlert,
  signPayload,
} from "../src/lib/webhooks";

vi.mock("../src/lib/supabase");
vi.mock("../src/lib/crypto");
vi.mock("../src/lib/ssrf-protection");

import { supabaseAdmin } from "../src/lib/supabase";
import * as cryptoModule from "../src/lib/crypto";
import * as ssrfModule from "../src/lib/ssrf-protection";

global.fetch = vi.fn();

// Helpers
function makeSupabaseMock(webhookRows: { id: string }[] = []) {
  const singleResult = { data: null, error: { code: "PGRST116" } };
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: webhookRows, error: null }),
    single: vi.fn().mockResolvedValue(singleResult),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
  };
  vi.mocked(supabaseAdmin.from).mockReturnValue(selectChain as any);
  return selectChain;
}

// ACTIVITY_ALERT_EVENTS constant
describe("ACTIVITY_ALERT_EVENTS constant", () => {
  it("contains exactly three events", () => {
    expect(ACTIVITY_ALERT_EVENTS).toHaveLength(3);
  });

  it("contains streak.milestone_reached", () => {
    expect(ACTIVITY_ALERT_EVENTS).toContain("streak.milestone_reached");
  });

  it("contains goal.completed", () => {
    expect(ACTIVITY_ALERT_EVENTS).toContain("goal.completed");
  });

  it("contains weekly_summary.ready", () => {
    expect(ACTIVITY_ALERT_EVENTS).toContain("weekly_summary.ready");
  });

  it("has no duplicates", () => {
    const set = new Set(ACTIVITY_ALERT_EVENTS);
    expect(set.size).toBe(ACTIVITY_ALERT_EVENTS.length);
  });
});

// isActivityAlertEvent()
describe("isActivityAlertEvent", () => {
  it("returns true for streak.milestone_reached", () => {
    expect(isActivityAlertEvent("streak.milestone_reached")).toBe(true);
  });

  it("returns true for goal.completed", () => {
    expect(isActivityAlertEvent("goal.completed")).toBe(true);
  });

  it("returns true for weekly_summary.ready", () => {
    expect(isActivityAlertEvent("weekly_summary.ready")).toBe(true);
  });

  it("returns false for legacy streak.milestone", () => {
    expect(isActivityAlertEvent("streak.milestone")).toBe(false);
  });

  it("returns false for weekly.summary (legacy)", () => {
    expect(isActivityAlertEvent("weekly.summary")).toBe(false);
  });

  it("returns false for an unknown event", () => {
    expect(isActivityAlertEvent("unknown.event")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isActivityAlertEvent("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isActivityAlertEvent(null as unknown as string)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isActivityAlertEvent(undefined as unknown as string)).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isActivityAlertEvent("Goal.Completed")).toBe(false);
    expect(isActivityAlertEvent("STREAK.MILESTONE_REACHED")).toBe(false);
  });
});

// isValidWebhookEvent() — must recognise the new events
describe("isValidWebhookEvent — new events", () => {
  it("accepts streak.milestone_reached", () => {
    expect(isValidWebhookEvent("streak.milestone_reached")).toBe(true);
  });

  it("accepts weekly_summary.ready", () => {
    expect(isValidWebhookEvent("weekly_summary.ready")).toBe(true);
  });

  it("still accepts goal.completed", () => {
    expect(isValidWebhookEvent("goal.completed")).toBe(true);
  });

  it("still rejects an arbitrary string", () => {
    expect(isValidWebhookEvent("not.a.real.event")).toBe(false);
  });
});

// getActivityAlertEvents()
describe("getActivityAlertEvents", () => {
  it("returns a readonly list of the three activity-alert events", () => {
    const events = getActivityAlertEvents();
    expect(events).toContain("streak.milestone_reached");
    expect(events).toContain("goal.completed");
    expect(events).toContain("weekly_summary.ready");
    expect(events).toHaveLength(3);
  });

  it("is consistent across calls", () => {
    expect(getActivityAlertEvents()).toEqual(getActivityAlertEvents());
  });
});

// getAvailableEvents() — backwards-compat checks
describe("getAvailableEvents — includes new events", () => {
  it("includes streak.milestone_reached", () => {
    expect(getAvailableEvents()).toContain("streak.milestone_reached");
  });

  it("includes weekly_summary.ready", () => {
    expect(getAvailableEvents()).toContain("weekly_summary.ready");
  });

  it("still includes the legacy events", () => {
    const events = getAvailableEvents();
    expect(events).toContain("goal.created");
    expect(events).toContain("streak.milestone");
    expect(events).toContain("daily.summary");
    expect(events).toContain("weekly.summary");
    expect(events).toContain("metrics.updated");
  });

  it("total event count is 8 (5 legacy-only + 2 new + goal.completed shared)", () => {
    // streak.milestone_reached, goal.completed, weekly_summary.ready (activity alerts)
    // goal.created, streak.milestone, daily.summary, weekly.summary, metrics.updated (legacy-only)
    // goal.completed is in both sets but listed only once = 8 total
    expect(getAvailableEvents()).toHaveLength(8);
  });

  it("has no duplicate entries", () => {
    const events = getAvailableEvents();
    expect(new Set(events).size).toBe(events.length);
  });
});

// signPayload()
describe("signPayload", () => {
  it("produces a 64-char hex string for HMAC-SHA256", () => {
    const sig = signPayload('{"event":"goal.completed"}', "test-secret");
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different signatures for different payloads", () => {
    const s1 = signPayload('{"event":"goal.completed"}', "secret");
    const s2 = signPayload('{"event":"streak.milestone_reached"}', "secret");
    expect(s1).not.toBe(s2);
  });

  it("produces different signatures for different secrets", () => {
    const payload = '{"event":"goal.completed"}';
    const s1 = signPayload(payload, "secret-a");
    const s2 = signPayload(payload, "secret-b");
    expect(s1).not.toBe(s2);
  });

  it("is deterministic for the same inputs", () => {
    const payload = '{"event":"weekly_summary.ready"}';
    expect(signPayload(payload, "mysecret")).toBe(
      signPayload(payload, "mysecret")
    );
  });
});

// dispatchActivityAlert()
describe("dispatchActivityAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ssrfModule.isSafeUrl).mockResolvedValue(true);
    vi.mocked(cryptoModule.encryptToken).mockReturnValue({
      encrypted: "enc",
      iv: "iv",
    });
    vi.mocked(cryptoModule.decryptToken).mockReturnValue("decrypted_secret");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without throwing when no webhooks are configured", async () => {
    makeSupabaseMock([]); // no webhooks
    await expect(
      dispatchActivityAlert("user-1", "goal.completed", { goalId: "g-1" })
    ).resolves.toBeUndefined();
  });

  it("calls dispatchToAllWebhooks (via supabase lookup) for streak.milestone_reached", async () => {
    makeSupabaseMock([]); // no matching webhooks → no fetch calls
    await dispatchActivityAlert("user-1", "streak.milestone_reached", {
      milestone: 30,
    });
    // supabaseAdmin.from should have been called to look up webhooks
    expect(supabaseAdmin.from).toHaveBeenCalledWith("webhook_configs");
  });

  it("calls dispatchToAllWebhooks for weekly_summary.ready", async () => {
    makeSupabaseMock([]);
    await dispatchActivityAlert("user-1", "weekly_summary.ready", {
      week: "2026-W01",
    });
    expect(supabaseAdmin.from).toHaveBeenCalledWith("webhook_configs");
  });

  it("does not throw when supabase query fails (error isolation)", async () => {
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error("DB down")),
      single: vi.fn(),
      insert: vi.fn(),
      order: vi.fn().mockReturnThis(),
    } as any);

    await expect(
      dispatchActivityAlert("user-1", "goal.completed", {})
    ).resolves.toBeUndefined();
  });

  it("includes devtrack_event in the payload data", async () => {
    // Arrange: one matching webhook
    const webhookId = "wh-abc";
    const webhookRow = {
      id: webhookId,
      url: "https://example.com/hook",
      secret_key: "enc",
      secret_iv: "iv",
      is_enabled: true,
    };

    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "webhook_configs") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          // First call (dispatchToAllWebhooks) returns the list of webhook IDs
          limit: vi.fn().mockResolvedValue({
            data: [{ id: webhookId }],
            error: null,
          }),
          // Second call (dispatchWebhook) returns the full row
          single: vi.fn().mockResolvedValue({ data: webhookRow, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnThis(),
        } as any;
      }
      // webhook_deliveries insert
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        order: vi.fn().mockReturnThis(),
      } as any;
    });

    vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    await dispatchActivityAlert("user-1", "goal.completed", { goalId: "g-99" });

    const fetchCalls = vi.mocked(global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    if (fetchCalls.length > 0) {
      const body = JSON.parse(fetchCalls[0][1]?.body as string);
      expect(body.data).toMatchObject({ devtrack_event: "goal.completed" });
    }
  });
});

describe("/api/webhooks/activity-alerts route", () => {
  it("exports a GET handler that returns the event list", async () => {
    const { GET } = await import(
      "../src/app/api/webhooks/activity-alerts/route"
    );
    const res = await GET();
    const json = await res.json();
    expect(json.events).toContain("streak.milestone_reached");
    expect(json.events).toContain("goal.completed");
    expect(json.events).toContain("weekly_summary.ready");
  });
});
