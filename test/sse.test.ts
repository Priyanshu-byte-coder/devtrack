import { describe, it, expect, vi, beforeEach } from "vitest";
import { sseConnections, sendSSEEvent } from "../src/lib/sse";

/**
 * sseConnections maps a user id to a *Set* of stream controllers, not a single
 * one, so a user with the dashboard open in several tabs receives each event in
 * all of them. Tests must register controllers as a Set.
 */
function connect(userId: string, ...controllers: Array<{ enqueue: unknown }>) {
  sseConnections.set(userId, new Set(controllers as never[]));
}

describe("sse module", () => {
  beforeEach(() => {
    sseConnections.clear();
  });

  describe("sseConnections", () => {
    it("starts empty", () => {
      expect(sseConnections.size).toBe(0);
    });

    it("can store a controller", () => {
      connect("user123", { enqueue: vi.fn() });
      expect(sseConnections.size).toBe(1);
    });
  });

  describe("sendSSEEvent", () => {
    it("does nothing when user has no connection", () => {
      sendSSEEvent("nonexistent-user", "event", { data: "test" });
      expect(sseConnections.size).toBe(0);
    });

    it("sends event to connected user", () => {
      const mockController = { enqueue: vi.fn() };
      connect("user123", mockController);

      sendSSEEvent("user123", "test-event", { message: "hello" });

      expect(mockController.enqueue).toHaveBeenCalledWith(
        'event: test-event\ndata: {"message":"hello"}\n\n'
      );
    });

    it("delivers to every open tab for the same user", () => {
      const tabA = { enqueue: vi.fn() };
      const tabB = { enqueue: vi.fn() };
      connect("user123", tabA, tabB);

      sendSSEEvent("user123", "test-event", { message: "hello" });

      expect(tabA.enqueue).toHaveBeenCalledTimes(1);
      expect(tabB.enqueue).toHaveBeenCalledTimes(1);
    });

    it("removes controller on enqueue error", () => {
      const mockController = {
        enqueue: vi.fn().mockImplementation(() => {
          throw new Error("Connection closed");
        }),
      };
      connect("user123", mockController);

      sendSSEEvent("user123", "test-event", { data: "test" });

      // Last controller for the user is gone, so the user entry goes too.
      expect(sseConnections.has("user123")).toBe(false);
    });

    it("drops only the broken tab and keeps the healthy one", () => {
      const broken = {
        enqueue: vi.fn().mockImplementation(() => {
          throw new Error("Connection closed");
        }),
      };
      const healthy = { enqueue: vi.fn() };
      connect("user123", broken, healthy);

      sendSSEEvent("user123", "test-event", { data: "test" });

      expect(healthy.enqueue).toHaveBeenCalledTimes(1);
      expect(sseConnections.get("user123")?.size).toBe(1);
    });

    it("handles multiple events for same user", () => {
      const mockController = { enqueue: vi.fn() };
      connect("user123", mockController);

      sendSSEEvent("user123", "event1", { data: "1" });
      sendSSEEvent("user123", "event2", { data: "2" });

      expect(mockController.enqueue).toHaveBeenCalledTimes(2);
    });

    it("handles different users independently", () => {
      const mockController1 = { enqueue: vi.fn() };
      const mockController2 = { enqueue: vi.fn() };
      connect("user1", mockController1);
      connect("user2", mockController2);

      sendSSEEvent("user1", "event", { data: "user1" });
      sendSSEEvent("user2", "event", { data: "user2" });

      expect(mockController1.enqueue).toHaveBeenCalledTimes(1);
      expect(mockController2.enqueue).toHaveBeenCalledTimes(1);
    });
  });
});
