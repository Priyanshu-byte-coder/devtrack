import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logError } from "../src/lib/error-handler";

const fixedDate = new Date("2026-05-31T12:00:00.000Z");

function consoleErrorMock() {
  return vi.mocked(console.error);
}

function lastConsoleErrorCall() {
  const calls = consoleErrorMock().mock.calls;
  return calls[calls.length - 1];
}

function parseProductionLog() {
  const [payload] = lastConsoleErrorCall();
  return JSON.parse(payload as string) as Record<string, unknown>;
}

describe("logError", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("exports logError as a function", () => {
    expect(logError).toEqual(expect.any(Function));
  });

  it("logs a formatted message and structured entry in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const error = new Error("Test error message");

    logError(error, {
      endpoint: "/api/test",
      operation: "testOperation",
    });

    expect(console.error).toHaveBeenCalledTimes(1);
    const [message, logEntry] = lastConsoleErrorCall();
    expect(message).toBe(
      `[${fixedDate.toISOString()}] /api/test - testOperation:`
    );
    expect(logEntry).toMatchObject({
      timestamp: fixedDate.toISOString(),
      endpoint: "/api/test",
      operation: "testOperation",
      userId: undefined,
      error: "Test error message",
    });
    expect((logEntry as { stack?: string }).stack).toContain("Test error message");
  });

  it("includes userId in the development log entry when provided", () => {
    vi.stubEnv("NODE_ENV", "development");

    logError(new Error("User error"), {
      endpoint: "/api/user",
      operation: "getUser",
      userId: "user-123",
    });

    const [, logEntry] = lastConsoleErrorCall();
    expect(logEntry).toMatchObject({
      endpoint: "/api/user",
      operation: "getUser",
      userId: "user-123",
      error: "User error",
    });
  });

  it("merges additional context into the structured log entry", () => {
    vi.stubEnv("NODE_ENV", "development");

    logError(new Error("Context error"), {
      endpoint: "/api/data",
      operation: "fetchData",
      additionalContext: { repoId: "repo-456", cacheKey: "key-789" },
    });

    const [, logEntry] = lastConsoleErrorCall();
    expect(logEntry).toMatchObject({
      endpoint: "/api/data",
      operation: "fetchData",
      repoId: "repo-456",
      cacheKey: "key-789",
      error: "Context error",
    });
  });

  it("allows additional context to override base log fields", () => {
    vi.stubEnv("NODE_ENV", "development");

    logError(new Error("Original error"), {
      endpoint: "/api/original",
      operation: "originalOperation",
      userId: "user-original",
      additionalContext: {
        endpoint: "/api/override",
        operation: "overrideOperation",
        userId: "user-override",
        error: "overridden error",
      },
    });

    const [message, logEntry] = lastConsoleErrorCall();
    expect(message).toBe(
      `[${fixedDate.toISOString()}] /api/override - overrideOperation:`
    );
    expect(logEntry).toMatchObject({
      endpoint: "/api/override",
      operation: "overrideOperation",
      userId: "user-override",
      error: "overridden error",
    });
  });

  it("logs string errors without a stack trace", () => {
    vi.stubEnv("NODE_ENV", "development");

    logError("String error", {
      endpoint: "/api/test",
      operation: "testOperation",
    });

    const [, logEntry] = lastConsoleErrorCall();
    expect(logEntry).toMatchObject({
      error: "String error",
      endpoint: "/api/test",
      operation: "testOperation",
    });
    expect(logEntry).not.toHaveProperty("stack");
  });

  it.each([
    ["null", null, "null"],
    ["undefined", undefined, "undefined"],
    ["number", 404, "404"],
    ["plain object", { message: "object failure" }, "[object Object]"],
  ])("formats %s errors with String(error)", (_label, error, expectedMessage) => {
    vi.stubEnv("NODE_ENV", "development");

    logError(error, {
      endpoint: "/api/test",
      operation: "testOperation",
    });

    const [, logEntry] = lastConsoleErrorCall();
    expect(logEntry).toMatchObject({ error: expectedMessage });
    expect(logEntry).not.toHaveProperty("stack");
  });

  it("uses custom Error subclass messages and includes the stack outside production", () => {
    vi.stubEnv("NODE_ENV", "test");

    class CustomApiError extends Error {
      constructor() {
        super("Custom formatted failure");
        this.name = "CustomApiError";
      }
    }

    logError(new CustomApiError(), {
      endpoint: "/api/custom",
      operation: "customOperation",
    });

    const parsed = parseProductionLog();
    expect(parsed).toMatchObject({
      timestamp: fixedDate.toISOString(),
      endpoint: "/api/custom",
      operation: "customOperation",
      error: "Custom formatted failure",
    });
    expect(parsed.stack).toEqual(expect.stringContaining("CustomApiError"));
  });

  it("logs JSON in production without stack traces", () => {
    vi.stubEnv("NODE_ENV", "production");

    logError(new Error("Production error"), {
      endpoint: "/api/prod",
      operation: "prodOperation",
      userId: "user-prod",
      additionalContext: { requestId: "req-123" },
    });

    expect(console.error).toHaveBeenCalledTimes(1);
    const parsed = parseProductionLog();
    expect(parsed).toEqual({
      timestamp: fixedDate.toISOString(),
      endpoint: "/api/prod",
      operation: "prodOperation",
      userId: "user-prod",
      error: "Production error",
      requestId: "req-123",
    });
    expect(parsed).not.toHaveProperty("stack");
  });

  it("logs JSON outside development and includes stack traces outside production", () => {
    vi.stubEnv("NODE_ENV", "test");

    logError(new Error("Test environment error"), {
      endpoint: "/api/test-env",
      operation: "testEnvOperation",
    });

    const [payload] = lastConsoleErrorCall();
    expect(typeof payload).toBe("string");
    const parsed = parseProductionLog();
    expect(parsed).toMatchObject({
      endpoint: "/api/test-env",
      operation: "testEnvOperation",
      error: "Test environment error",
    });
    expect(parsed.stack).toEqual(
      expect.stringContaining("Test environment error")
    );
  });

  it("serializes undefined context fields out of non-development JSON output", () => {
    vi.stubEnv("NODE_ENV", "production");

    logError("No user", {
      endpoint: "/api/no-user",
      operation: "withoutUser",
    });

    const parsed = parseProductionLog();
    expect(parsed).toEqual({
      timestamp: fixedDate.toISOString(),
      endpoint: "/api/no-user",
      operation: "withoutUser",
      error: "No user",
    });
    expect(parsed).not.toHaveProperty("userId");
  });

  it("throws when context is null", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(() =>
      logError(new Error("Missing context"), null as never)
    ).toThrow(TypeError);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("throws when context is undefined", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() =>
      logError(new Error("Missing context"), undefined as never)
    ).toThrow(TypeError);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("throws in non-development logging when additional context cannot be serialized", () => {
    vi.stubEnv("NODE_ENV", "production");
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() =>
      logError("Circular context", {
        endpoint: "/api/circular",
        operation: "serialize",
        additionalContext: circular,
      })
    ).toThrow(TypeError);
    expect(console.error).not.toHaveBeenCalled();
  });
});
