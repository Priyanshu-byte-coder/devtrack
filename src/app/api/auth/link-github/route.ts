import { getServerSession } from "@/lib/server-session";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.json(
      { error: "Must be signed in to link an account" },
      { status: 401 }
    );
  }

  // Bind the random nonce to the authenticated session by appending the
  // session user's GitHub ID. The callback verifies that the ID embedded
  // in the state matches the session that completes the flow, so a
  // state cookie placed on a different user's browser (e.g. via XSS or
  // cookie tossing) cannot be used to link an attacker's GitHub account
  // to the victim's devtrack profile.
  const nonce = randomBytes(32).toString("hex");
  const state = `${nonce}.${session.githubId}`;
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const redirectUri = `${baseUrl}/api/auth/link-github/callback`;

  const githubUrl = new URL("https://github.com/login/oauth/authorize");
  githubUrl.searchParams.set("client_id", process.env.GITHUB_ID ?? "");
  githubUrl.searchParams.set("redirect_uri", redirectUri);
  githubUrl.searchParams.set("scope", "read:user");
  githubUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(githubUrl, { status: 307 });
  response.cookies.set("link_github_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
