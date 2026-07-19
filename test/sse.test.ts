import { describe, it, expect, vi, beforeEach } from "vitest";
import { sseConnections, sendSSEEvent } from "../src/lib/sse";

describe("sse module", () => {
  beforeEach(() => {
    sseConnections.clear();
  });

  describe("sseConnections", () => {
    it("starts empty", () => {
      expect(sseConnections.size).toBe(0);
    });

    it("can store a controller", () => {
      const mockController = {
        enqueue: vi.fn(),
      } as any;
      sseConnections.set("user123", mockController);
      expect(sseConnections.size).toBe(1);
    });
  });

  describe("sendSSEEvent", () => {
    it("does nothing when user has no connection", () => {
      sendSSEEvent("nonexistent-user", "event", { data: "test" });
      expect(sseConnections.size).toBe(0);
    });

    it("sends event to connected user", () => {
      const mockController = {
        enqueue: vi.fn(),
      } as any;
      sseConnections.set("user123", mockController);

      sendSSEEvent("user123", "test-event", { message: "hello" });

      expect(mockController.enqueue).toHaveBeenCalledWith(
        'event: test-event\ndata: {"message":"hello"}\n\n'
      );
    });

    it("removes controller on enqueue error", () => {
      const mockController = {
        enqueue: vi.fn().mockImplementation(() => {
          throw new Error("Connection closed");
        }),
      } as any;
      sseConnections.set("user123", mockController);

      sendSSEEvent("user123", "test-event", { data: "test" });

      expect(sseConnections.has("user123")).toBe(false);
    });

    it("handles multiple events for same user", () => {
      const mockController = {
        enqueue: vi.fn(),
      } as any;
      sseConnections.set("user123", mockController);

      sendSSEEvent("user123", "event1", { data: "1" });
      sendSSEEvent("user123", "event2", { data: "2" });

      expect(mockController.enqueue).toHaveBeenCalledTimes(2);
    });

    it("handles different users independently", () => {
      const mockController1 = { enqueue: vi.fn() } as any;
      const mockController2 = { enqueue: vi.fn() } as any;
      sseConnections.set("user1", mockController1);
      sseConnections.set("user2", mockController2);

      sendSSEEvent("user1", "event", { data: "user1" });
      sendSSEEvent("user2", "event", { data: "user2" });

      expect(mockController1.enqueue).toHaveBeenCalledTimes(1);
      expect(mockController2.enqueue).toHaveBeenCalledTimes(1);
    });
  });
});
