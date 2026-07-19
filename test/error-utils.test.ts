import { describe, it, expect } from "vitest";
import { getSafeErrorMessage, getSafeApiErrorMessage } from "../src/lib/error-utils";

describe("error-utils", () => {
  describe("getSafeErrorMessage", () => {
    it("returns the mapped message for known safe error keys", () => {
      const error = new Error("TokenRevoked");
      expect(getSafeErrorMessage(error)).toBe("Your GitHub session has expired. Please sign in again.");
    });

    it("replaces unknown messages with a generic string in production", () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = "production";

      try {
        const error = new Error("relation \"goals\" does not exist");
        expect(getSafeErrorMessage(error)).toBe("An unexpected error occurred. Our team has been notified.");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it("returns raw message in development mode", () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = "development";

      try {
        const error = new Error("relation \"goals\" does not exist");
        expect(getSafeErrorMessage(error)).toBe("relation \"goals\" does not exist");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it("returns Unknown error for empty error messages in development", () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = "development";

      try {
        const error = new Error("");
        expect(getSafeErrorMessage(error)).toBe("Unknown error");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });

  describe("getSafeApiErrorMessage", () => {
    it("returns the mapped message for known safe error keys", () => {
      expect(
        getSafeApiErrorMessage("TokenRevoked", "production")
      ).toBe("Your GitHub session has expired. Please sign in again.");
    });

    it("replaces unknown messages with a generic string in production", () => {
  const raw = 'duplicate key value violates unique constraint "users_github_id_key"';
  const result = getSafeApiErrorMessage(raw, "production");  // ✅ add this line
  expect(result).toBe("An unexpected error occurred.");
});

    it("returns the raw message in development mode for debuggability", () => {
      const raw = 'relation "goals" does not exist';
      const result = getSafeApiErrorMessage(raw, "development");
      expect(result).toBe(raw);
    });

    it("falls back to the generic message for an empty string in production", () => {
      expect(getSafeApiErrorMessage("", "production")).toBe("An unexpected error occurred.");
    });

    it("returns 'Unknown error' for an empty string in development", () => {
      expect(getSafeApiErrorMessage("", "development")).toBe("Unknown error");
    });
  });
});
