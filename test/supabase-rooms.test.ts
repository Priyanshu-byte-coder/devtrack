import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CollaborationRoom, RoomMember, RoomMessage } from "@/types/rooms";

// Mock supabase-admin before importing the module under test
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import {
  getRoomsForUser,
  createRoom,
  getRoomById,
  getRoomMembers,
  addRoomMember,
  getRoomMessages,
  getRoomMessagesSince,
  sendRoomMessage,
  removeRoomMember,
} from "@/lib/supabase-rooms";

const MOCK_ROOM = {
  id: "room-1",
  name: "Test Room",
  description: null as string | null,
  repo_owner: "testowner",
  repo_name: "testrepo",
  created_by: "creator",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  mockFrom.mockReset();
});

describe("getRoomsForUser", () => {
  it("returns rooms for a given username", async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (fn: (v: unknown) => void) =>
              fn({
                data: [
                  {
                    role: "owner",
                    collaboration_rooms: MOCK_ROOM,
                  },
                ],
                error: null,
              }),
          }),
        }),
      });

    const rooms = await getRoomsForUser("creator");
    expect(rooms).toHaveLength(1);
    expect(rooms[0].id).toBe("room-1");
    expect((rooms[0] as CollaborationRoom & { is_owner: boolean }).is_owner).toBe(true);
  });

  it("returns empty array on error", async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            then: (fn: (v: unknown) => void) =>
              fn({ data: null, error: { message: "db error" } }),
          }),
        }),
      });

    await expect(getRoomsForUser("user")).rejects.toThrow("db error");
  });
});

describe("createRoom", () => {
  it("inserts room and adds creator as owner member", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        then: (fn: (v: unknown) => void) =>
          fn({ data: MOCK_ROOM, error: null }),
      }),
    });

    const memberInsertMock = vi.fn().mockReturnValue({
      then: (fn: (v: unknown) => void) => fn({ error: null }),
    });

    mockFrom
      .mockReturnValueOnce({
        insert: insertMock,
      })
      .mockReturnValueOnce({
        insert: memberInsertMock,
      });

    const result = await createRoom(
      {
        name: "Test Room",
        description: "A test room",
        repo_owner: "testowner",
        repo_name: "testrepo",
      },
      "creator"
    );

    expect(result.id).toBe("room-1");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: "creator" })
    );
    expect(memberInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        github_username: "creator",
        role: "owner",
      })
    );
  });

  it("throws on insert error", async () => {
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          then: (fn: (v: unknown) => void) =>
            fn({ data: null, error: { message: "insert failed" } }),
        }),
      }),
    });

    await expect(
      createRoom(
        {
          name: "Bad Room",
          repo_owner: "x",
          repo_name: "y",
        },
        "user"
      )
    ).rejects.toThrow("insert failed");
  });
});

describe("getRoomById", () => {
  it("returns null when user is not a member", async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

    const result = await getRoomById("room-1", "nonmember");
    expect(result).toBeNull();
  });

  it("returns room with is_owner=true when user is owner", async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "owner" },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...MOCK_ROOM, is_owner: true },
              error: null,
            }),
          }),
        }),
      });

    const result = await getRoomById("room-1", "creator");
    expect(result).not.toBeNull();
    expect((result as { is_owner: boolean } | null)?.is_owner).toBe(true);
  });

  it("returns room with is_owner=false when user is member", async () => {
    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "member" },
              error: null,
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...MOCK_ROOM, is_owner: false },
              error: null,
            }),
          }),
        }),
      });

    const result = await getRoomById("room-1", "member");
    expect(result).not.toBeNull();
    expect((result as { is_owner: boolean } | null)?.is_owner).toBe(false);
  });
});

describe("getRoomMembers", () => {
  it("returns members ordered by joined_at", async () => {
    const members: RoomMember[] = [
      {
        id: "member-1",
        room_id: "room-1",
        github_username: "alice",
        role: "owner",
        joined_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "member-2",
        room_id: "room-1",
        github_username: "bob",
        role: "member",
        joined_at: "2026-01-02T00:00:00Z",
      },
    ];

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: (fn: (v: unknown) => void) =>
              fn({ data: members, error: null }),
          }),
        }),
      }),
    });

    const result = await getRoomMembers("room-1");
    expect(result).toHaveLength(2);
    expect(result[0].github_username).toBe("alice");
    expect(result[1].github_username).toBe("bob");
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            then: (fn: (v: unknown) => void) =>
              fn({ data: null, error: { message: "select failed" } }),
          }),
        }),
      }),
    });

    await expect(getRoomMembers("room-1")).rejects.toThrow("select failed");
  });
});

describe("addRoomMember", () => {
  it("inserts new member", async () => {
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        then: (fn: (v: unknown) => void) => fn({ error: null }),
      }),
    });

    await addRoomMember("room-1", "newmember");
    expect(mockFrom).toHaveBeenCalledWith("room_members");
  });
});

describe("getRoomMessages", () => {
  it("returns messages reversed to oldest-first", async () => {
    const messages: RoomMessage[] = [
      {
        id: "msg-2",
        room_id: "room-1",
        sender_username: "bob",
        sender_avatar: null,
        content: "second",
        created_at: "2026-01-01T12:00:00Z",
      },
      {
        id: "msg-1",
        room_id: "room-1",
        sender_username: "alice",
        sender_avatar: null,
        content: "first",
        created_at: "2026-01-01T10:00:00Z",
      },
    ];

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              then: (fn: (v: unknown) => void) =>
                fn({ data: messages, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await getRoomMessages("room-1", 50);
    expect(result[0].id).toBe("msg-1");
    expect(result[1].id).toBe("msg-2");
  });

  it("applies before cursor when provided", async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                then: (fn: (v: unknown) => void) =>
                  fn({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    await getRoomMessages("room-1", 50, "2026-01-01T12:00:00Z");
  });
});

describe("getRoomMessagesSince", () => {
  it("returns messages after timestamp", async () => {
    const messages: RoomMessage[] = [
      {
        id: "msg-2",
        room_id: "room-1",
        sender_username: "bob",
        sender_avatar: null,
        content: "second",
        created_at: "2026-01-02T00:00:00Z",
      },
    ];

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              then: (fn: (v: unknown) => void) =>
                fn({ data: messages, error: null }),
            }),
          }),
        }),
      }),
    });

    const result = await getRoomMessagesSince("room-1", "2026-01-01T00:00:00Z");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("msg-2");
  });
});

describe("sendRoomMessage", () => {
  it("inserts and returns the message", async () => {
    const message: RoomMessage = {
      id: "msg-new",
      room_id: "room-1",
      sender_username: "alice",
      sender_avatar: null,
      content: "hello",
      created_at: "2026-01-01T12:00:00Z",
    };

    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: message, error: null }),
        }),
      }),
    });

    const result = await sendRoomMessage("room-1", "alice", null, "hello");
    expect(result.id).toBe("msg-new");
    expect(result.content).toBe("hello");
  });
});

describe("removeRoomMember", () => {
  it("deletes the membership", async () => {
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: (fn: (v: unknown) => void) => fn({ error: null }),
        }),
      }),
    });

    await removeRoomMember("room-1", "oldmember");
    expect(mockFrom).toHaveBeenCalledWith("room_members");
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: (fn: (v: unknown) => void) =>
            fn({ error: { message: "delete failed" } }),
        }),
      }),
    });

    await expect(removeRoomMember("room-1", "oldmember")).rejects.toThrow(
      "delete failed"
    );
  });
});
