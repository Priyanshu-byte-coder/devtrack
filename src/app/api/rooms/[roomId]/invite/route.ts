import { githubRateLimitResponse } from "@/lib/github-rate-limit";
import { githubRequest } from "@/lib/github-request";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import {
  getRoomById,
  getRoomMembers,
  createRoomInvitation,
  notifyRoomInvitation,
} from "@/lib/supabase-rooms";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session.githubLogin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const room = await getRoomById(roomId, session.githubId!);
  if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!room.is_owner)
    return NextResponse.json(
      { error: "Only the room owner can invite" },
      { status: 403 }
    );
  const body = await req.json().catch(() => null);
  const github_username =
    body && typeof body.github_username === "string"
      ? body.github_username.trim()
      : "";
  if (!github_username)
    return NextResponse.json(
      { error: "github_username required" },
      { status: 400 }
    );
  // GitHub usernames: 1-39 chars, alphanumeric + hyphens, no leading/trailing hyphen
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(github_username))
    return NextResponse.json(
      { error: "Invalid GitHub username" },
      { status: 400 }
    );
  try {
    const ghRes = await githubRequest(
      `https://api.github.com/users/${github_username}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(session.accessToken
            ? { Authorization: `Bearer ${session.accessToken}` }
            : {}),
        },
      }
    );
    if (ghRes.status === 404)
      return NextResponse.json(
        { error: `GitHub user "${github_username}" does not exist` },
        { status: 404 }
      );
    if (!ghRes.ok)
      return NextResponse.json(
        { error: "Could not verify GitHub user" },
        { status: 502 }
      );
    const invitedUser = (await ghRes.json()) as { id: number; login: string };
    const members = await getRoomMembers(roomId);
    if (members.some((m) => m.github_id === String(invitedUser.id)))
      return NextResponse.json(
        { error: "User is already a member" },
        { status: 409 }
      );
    try {
      await createRoomInvitation(
        roomId,
        invitedUser.login,
        session.githubLogin,
        String(invitedUser.id)
      );
    } catch (error: any) {
      const githubLimit = githubRateLimitResponse(error);
      if (githubLimit) return githubLimit;

      if (error?.code === "23505")
        return NextResponse.json(
          { error: "An invitation is already pending for this user" },
          { status: 409 }
        );
      throw error;
    }
    await notifyRoomInvitation(github_username, room.name, session.githubLogin);
    return NextResponse.json({ success: true, status: "pending" });
  } catch (error) {
    const githubLimit = githubRateLimitResponse(error);
    if (githubLimit) return githubLimit;
    return NextResponse.json(
      { error: "Invitation unavailable" },
      { status: 503 }
    );
  }
}
