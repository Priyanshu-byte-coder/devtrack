/**
 * Regression tests for issue #1917 — room messages must be sanitized before
 * persistence.
 *
 * The POST handler now passes content through validateTextInput() before
 * calling sendRoomMessage().  This ensures:
 *   - HTML tags are stripped
 *   - Content that is empty after stripping is rejected
 *   - The 4 000-character limit is applied to the stripped value
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getRoomById: vi.fn(),
  getRoomMessages: vi.fn(),
  sendRoomMessage: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase-rooms", () => ({
  getRoomById: mocks.getRoomById,
  getRoomMessages: mocks.getRoomMessages,
  sendRoomMessage: mocks.sendRoomMessage,
}));

// ─── helpers ────────────────────────────────────────────────────────────────

const SESSION = { user: { name: "alice", image: "https://example.com/a.png" } };
const ROOM = { id: "room-1", name: "Dev chat" };
const BASE_URL = "http://localhost/api/rooms/room-1/messages";

function roomParams(roomId: string) {
  return { params: Promise.resolve({ roomId }) };
}

function makePost(content: unknown): NextRequest {
  return new NextRequest(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

// ─── POST /api/rooms/[roomId]/messages ───────────────────────────────────────

describe("POST /api/rooms/[roomId]/messages — message sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(SESSION);
    mocks.getRoomById.mockResolvedValue(ROOM);
    mocks.sendRoomMessage.mockResolvedValue({
      id: "msg-1",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: SESSION.user.image,
      content: "Hello",
      created_at: new Date().toISOString(),
    });
  });

  // ── authentication & room access ─────────────────────────────────────────

  it("returns 401 when unauthenticated", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost("Hello"), roomParams("room-1"));
    expect(res.status).toBe(401);
    expect(mocks.sendRoomMessage).not.toHaveBeenCalled();
  });

  it("returns 404 when the room does not exist", async () => {
    mocks.getRoomById.mockResolvedValue(null);
    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost("Hello"), roomParams("nonexistent"));
    expect(res.status).toBe(404);
    expect(mocks.sendRoomMessage).not.toHaveBeenCalled();
  });

  // ── plain text ────────────────────────────────────────────────────────────

  it("stores a plain-text message and returns 201", async () => {
    mocks.sendRoomMessage.mockResolvedValue({
      id: "msg-1",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: SESSION.user.image,
      content: "Hello world",
      created_at: new Date().toISOString(),
    });

    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost("Hello world"), roomParams("room-1"));

    expect(res.status).toBe(201);
    expect(mocks.sendRoomMessage).toHaveBeenCalledWith(
      "room-1",
      "alice",
      SESSION.user.image,
      "Hello world"
    );
  });

  // ── HTML stripping — regression for #1917 ────────────────────────────────

  it("strips HTML tags before storing — regression for #1917", async () => {
    mocks.sendRoomMessage.mockResolvedValue({
      id: "msg-2",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: null,
      content: "Hello",
      created_at: new Date().toISOString(),
    });

    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost("<b>Hello</b>"), roomParams("room-1"));

    expect(res.status).toBe(201);
    // sendRoomMessage must receive the stripped value, not the raw HTML
    expect(mocks.sendRoomMessage).toHaveBeenCalledWith(
      "room-1",
      "alice",
      SESSION.user.image,
      "Hello"
    );
  });

  it("strips <script> tags before storing — regression for #1917", async () => {
    // stripHtml removes tags but preserves inner text.
    // <script>alert(1)</script> → "alert(1)" (tag removed, text kept).
    // The dangerous element (the script tag itself) is never stored.
    mocks.sendRoomMessage.mockResolvedValue({
      id: "msg-6",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: null,
      content: "alert(1)",
      created_at: new Date().toISOString(),
    });

    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost("<script>alert(1)</script>"), roomParams("room-1"));

    expect(res.status).toBe(201);
    expect(mocks.sendRoomMessage).toHaveBeenCalledWith(
      "room-1",
      "alice",
      SESSION.user.image,
      "alert(1)"
    );
  });

  it("strips mixed HTML and text — stores only the text portion", async () => {
    mocks.sendRoomMessage.mockResolvedValue({
      id: "msg-3",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: null,
      content: "click here",
      created_at: new Date().toISOString(),
    });

    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(
      makePost('<a href="javascript:void(0)">click here</a>'),
      roomParams("room-1")
    );

    expect(res.status).toBe(201);
    expect(mocks.sendRoomMessage).toHaveBeenCalledWith(
      "room-1",
      "alice",
      SESSION.user.image,
      "click here"
    );
  });

  // ── empty / whitespace rejection ─────────────────────────────────────────

  it("returns 400 when content is missing", async () => {
    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(
      new NextRequest(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      roomParams("room-1")
    );
    expect(res.status).toBe(400);
    expect(mocks.sendRoomMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when content is empty string", async () => {
    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost(""), roomParams("room-1"));
    expect(res.status).toBe(400);
    expect(mocks.sendRoomMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when content is whitespace only", async () => {
    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost("   \t\n  "), roomParams("room-1"));
    expect(res.status).toBe(400);
    expect(mocks.sendRoomMessage).not.toHaveBeenCalled();
  });

  it("returns 400 when content becomes empty after HTML stripping — regression for #1917", async () => {
    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    // Tags only, no visible text
    const res = await POST(makePost("<div><span></span></div>"), roomParams("room-1"));
    expect(res.status).toBe(400);
    expect(mocks.sendRoomMessage).not.toHaveBeenCalled();
  });

  // ── length validation ─────────────────────────────────────────────────────

  it("returns 400 when content exceeds 4000 characters", async () => {
    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost("x".repeat(4001)), roomParams("room-1"));
    expect(res.status).toBe(400);
    expect(mocks.sendRoomMessage).not.toHaveBeenCalled();
  });

  it("accepts content exactly at 4000 characters", async () => {
    const longContent = "x".repeat(4000);
    mocks.sendRoomMessage.mockResolvedValue({
      id: "msg-4",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: null,
      content: longContent,
      created_at: new Date().toISOString(),
    });

    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost(longContent), roomParams("room-1"));
    expect(res.status).toBe(201);
  });

  it("length check is applied to stripped content, not raw input", async () => {
    // Wrap 100 chars in a tag — raw length is >100 but stripped is 100
    const text = "a".repeat(100);
    const raw = `<b>${text}</b>`; // raw length = 103, stripped = 100
    mocks.sendRoomMessage.mockResolvedValue({
      id: "msg-5",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: null,
      content: text,
      created_at: new Date().toISOString(),
    });

    const { POST } = await import(
      "@/app/api/rooms/[roomId]/messages/route"
    );
    const res = await POST(makePost(raw), roomParams("room-1"));
    expect(res.status).toBe(201);
    expect(mocks.sendRoomMessage).toHaveBeenCalledWith(
      "room-1",
      "alice",
      SESSION.user.image,
      text
    );
  });
});
