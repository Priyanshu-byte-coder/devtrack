import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  room: vi.fn(),
  members: vi.fn(),
  github: vi.fn(),
  invite: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/github-request", () => ({ githubRequest: mocks.github }));
vi.mock("@/lib/supabase-rooms", () => ({
  getRoomById: mocks.room,
  getRoomMembers: mocks.members,
  createRoomInvitation: mocks.invite,
  notifyRoomInvitation: mocks.notify,
}));
import { POST } from "@/app/api/rooms/[roomId]/invite/route";
import { GitHubRateLimitError } from "@/lib/github-rate-limit";
const context = { params: Promise.resolve({ roomId: "room-1" }) };
const request = (body: unknown) =>
  new Request("http://localhost/api/rooms/room-1/invite", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({
    githubId: "101",
    githubLogin: "owner",
    accessToken: "dummy",
  });
  mocks.room.mockResolvedValue({ name: "Room", is_owner: true });
  mocks.members.mockResolvedValue([]);
  mocks.github.mockResolvedValue(
    new Response(JSON.stringify({ id: 202, login: "canonical" }))
  );
});
it.each([null, [], { github_username: 123 }, { github_username: "-invalid" }])(
  "rejects invalid invitation %j before GitHub requests",
  async (body) => {
    expect((await POST(request(body), context)).status).toBe(400);
    expect(mocks.github).not.toHaveBeenCalled();
  }
);
it("resolves canonical stable ID instead of trusting the typed handle", async () => {
  expect(
    (await POST(request({ github_username: " canonical " }), context)).status
  ).toBe(200);
  expect(mocks.room).toHaveBeenCalledWith("room-1", "101");
  expect(mocks.invite).toHaveBeenCalledExactlyOnceWith(
    "room-1",
    "canonical",
    "owner",
    "202"
  );
});
it("returns GitHub cooldown information without creating an invitation", async () => {
  mocks.github.mockRejectedValue(
    new GitHubRateLimitError(new Date(Date.now() + 90_000), 90)
  );
  const response = await POST(request({ github_username: "member" }), context);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("90");
  expect(mocks.invite).not.toHaveBeenCalled();
});
it("denies non-owner invitations before resolving another account", async () => {
  mocks.room.mockResolvedValue({ is_owner: false });
  expect(
    (await POST(request({ github_username: "member" }), context)).status
  ).toBe(403);
  expect(mocks.github).not.toHaveBeenCalled();
});
