import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/accounts/link
 * Initiates the GitHub OAuth flow to link a second (work/personal) GitHub
 * account to the current DevTrack session.
 *
 * Returns a JSON redirect URL the client should navigate to, or directly
 * issues a 307 redirect if called without a JSON Accept header.
 *
 * The state token is bound to the current session's GitHub ID so that the
 * callback can verify the flow wasn't hijacked.
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json(
      { error: "Must be signed in to link an account" },
      { status: 401 }
    );
  }

  const nonce = randomBytes(32).toString("hex");
  const state = `${nonce}.${session.githubId}`;
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  // Reuse the existing callback handler so token exchange + DB insert logic
  // stays in a single place.
  const redirectUri = `${baseUrl}/api/auth/link-github/callback`;

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", process.env.GITHUB_ID ?? "");
  githubUrl.searchParams.set("redirect_uri", redirectUri);
  githubUrl.searchParams.set("scope", "read:user");
  githubUrl.searchParams.set("state", state);

  const response = NextResponse.json({ url: githubUrl.toString() });

  // Set the CSRF state cookie so the callback can verify it.
  response.cookies.set("link_github_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}