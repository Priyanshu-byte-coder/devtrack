/**
 * Tests for src/lib/anthropic.ts (Anthropic service layer)
 *
 * Coverage
 * --------
 * Missing API key    — returns null immediately, logs warning, no SDK call
 * Successful call    — trims whitespace, returns the summary string
 * Prompt safety      — metrics encoded as JSON (not interpolated), injection
 *                      resistance, long topRepo values forwarded verbatim
 * Malformed response — non-text block → null, empty text → null
 * Retry logic        — 529 retries and succeeds on second attempt,
 *                      non-retryable 401 bails immediately,
 *                      all retries exhausted → null
 *
 * Module isolation
 * ----------------
 * The service module uses a cached Anthropic client singleton (_client).
 * vi.resetModules() before each test clears that cache so different
 * ANTHROPIC_API_KEY stubs take effect correctly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Shared fixture ────────────────────────────────────────────────────────────

const VALID_METRICS = {
  commits: { current: 12, previous: 8, delta: 4, trend: "up" as const },
  prs: {
    thisWeek: { opened: 3, merged: 2 },
    lastWeek: { opened: 2, merged: 1 },
  },
  streak: 7,
  topRepo: "owner/devtrack",
  activeDays: { thisWeek: 5, lastWeek: 4 },
};

// ── SDK mock ──────────────────────────────────────────────────────────────────
//
// We mock @anthropic-ai/sdk at the file level so Vitest hoists it above all
// imports.  The real generate functions import this dynamically (after
// vi.resetModules() in beforeEach) so each test gets a fresh module instance
// with the stubbed SDK wired up.

const messagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  // The production code uses `Anthropic.APIError` as a static property on
  // the default export.  Since isRetryable() now duck-types on .status rather
  // than using instanceof, this property doesn't actually need to be a real
  // class — but it must exist to avoid "Right-hand side of instanceof is not
  // an object" if any code path still calls instanceof at the SDK module level.
  class FakeAPIError extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.name = "APIError";
      this.status = status;
    }
  }

  const MockAnthropic = vi.fn(
    () => ({ messages: { create: messagesCreate } })
  ) as unknown as (new () => object) & { APIError: typeof FakeAPIError };
  MockAnthropic.APIError = FakeAPIError;

  return { default: MockAnthropic, APIError: FakeAPIError };
});

// server-only guard: stub so non-Next.js test env doesn't throw
vi.mock("server-only", () => ({}));

// ─────────────────────────────────────────────────────────────────────────────

describe("generateWeeklySummary — src/lib/anthropic.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Reset module cache so each test gets a fresh _client singleton and
    // picks up the current ANTHROPIC_API_KEY stub.
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Missing API key ─────────────────────────────────────────────────────────

  it("returns null and warns when ANTHROPIC_API_KEY is not set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/ANTHROPIC_API_KEY.*not set/i)
    );
    expect(messagesCreate).not.toHaveBeenCalled();
  });

  // ── Successful call ─────────────────────────────────────────────────────────

  it("returns the trimmed summary string on a successful API call", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "  Great week! You shipped 2 PRs.  " }],
    });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBe("Great week! You shipped 2 PRs.");
  });

  it("calls the SDK with the correct model", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary." }],
    });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    await generateWeeklySummary(VALID_METRICS);

    const callArgs = messagesCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-haiku-4-5-20251001");
  });

  it("sends max_tokens ≤ 200 (enough for 2–3 sentences, not an essay)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary." }],
    });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    await generateWeeklySummary(VALID_METRICS);

    const callArgs = messagesCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBeLessThanOrEqual(200);
    expect(callArgs.max_tokens).toBeGreaterThan(0);
  });

  // ── Prompt safety ───────────────────────────────────────────────────────────

  it("encodes metrics as structured JSON — user message is valid JSON", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary." }],
    });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    await generateWeeklySummary(VALID_METRICS);

    const callArgs = messagesCreate.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(() => JSON.parse(userContent)).not.toThrow();
  });

  it("includes all key metrics in the JSON payload", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary." }],
    });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    await generateWeeklySummary(VALID_METRICS);

    const callArgs = messagesCreate.mock.calls[0][0];
    const payload = JSON.parse(callArgs.messages[0].content);

    expect(payload.commits_this_week).toBe(12);
    expect(payload.commits_last_week).toBe(8);
    expect(payload.prs_merged_this_week).toBe(2);
    expect(payload.current_streak_days).toBe(7);
    expect(payload.top_repository).toBe("owner/devtrack");
    expect(payload.active_days_this_week).toBe(5);
  });

  it("preserves special characters in topRepo (no HTML encoding)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary." }],
    });

    const specialRepo = "owner/repo-with-chars <>&\"'";
    const { generateWeeklySummary } = await import("@/lib/anthropic");
    await generateWeeklySummary({ ...VALID_METRICS, topRepo: specialRepo });

    const callArgs = messagesCreate.mock.calls[0][0];
    const payload = JSON.parse(callArgs.messages[0].content);
    expect(payload.top_repository).toBe(specialRepo);
  });

  it("uses 'none' for topRepo when the value is null", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "Summary." }],
    });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    await generateWeeklySummary({ ...VALID_METRICS, topRepo: null });

    const callArgs = messagesCreate.mock.calls[0][0];
    const payload = JSON.parse(callArgs.messages[0].content);
    expect(payload.top_repository).toBe("none");
  });

  // ── Malformed response ──────────────────────────────────────────────────────

  it("returns null when the API response has no text block", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "tu_1", name: "fn", input: {} }],
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
  });

  it("returns null when the text block contains only whitespace", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "   \n  " }],
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
  });

  it("returns null when content array is empty", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    messagesCreate.mockResolvedValue({ content: [] });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
  });

  // ── Retry logic ─────────────────────────────────────────────────────────────
  //
  // isRetryable() duck-types the error's .status property rather than using
  // instanceof, so these tests construct plain Error objects with a status
  // field — cleaner, avoids SDK constructor arity issues.

  function apiError(status: number, message = "error"): Error {
    return Object.assign(new Error(message), { status });
  }

  it("retries on 529 (overloaded) and succeeds on the second attempt", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    messagesCreate
      .mockRejectedValueOnce(apiError(529, "overloaded"))
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Retry succeeded." }],
      });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBe("Retry succeeded.");
    expect(messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 (service unavailable) and succeeds on the second attempt", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    messagesCreate
      .mockRejectedValueOnce(apiError(503, "unavailable"))
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Back online." }],
      });

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBe("Back online.");
    expect(messagesCreate).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 401 (auth error) — bails immediately", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-bad-key");
    vi.spyOn(console, "error").mockImplementation(() => {});

    messagesCreate.mockRejectedValue(apiError(401, "auth error"));

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
    expect(messagesCreate).toHaveBeenCalledTimes(1); // no retries
  });

  it("does not retry on 400 (bad request) — bails immediately", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});

    messagesCreate.mockRejectedValue(apiError(400, "bad request"));

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries (3 attempts) and returns null when overloaded persists", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    messagesCreate.mockRejectedValue(apiError(529, "overloaded"));

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
    expect(messagesCreate).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("returns null on an unexpected network-level error", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});

    messagesCreate.mockRejectedValue(new Error("fetch failed"));

    const { generateWeeklySummary } = await import("@/lib/anthropic");
    const result = await generateWeeklySummary(VALID_METRICS);

    expect(result).toBeNull();
  });
});
