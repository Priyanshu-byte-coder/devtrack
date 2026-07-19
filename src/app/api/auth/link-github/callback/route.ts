// @ts-nocheck
import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { encryptToken } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase";

interface GitHubTokenResponse {
  access_token?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
}

function buildSettingsRedirect(errorOrSuccess: string, value: string): URL {
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const url = new URL("/dashboard/settings", baseUrl);
  url.searchParams.set(errorOrSuccess, value);
  return url;
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get("link_github_state")?.value;

  if (!stateCookie || !state || stateCookie !== state) {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "invalid_state"),
      { status: 302 }
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.githubId) {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "unauthorized"),
      { status: 302 }
    );
  }

  // Verify the state was generated for this session's user.
  // The state format is `<nonce>.<githubId>` (set in the initiation handler).
  // Without this check, an attacker who places their state cookie on a
  // victim's browser can trick the callback into linking the attacker's
  // secondary GitHub account to the victim's devtrack profile.
  const embeddedGithubId = state.split(".").slice(1).join(".");
  if (!embeddedGithubId || embeddedGithubId !== session.githubId) {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "invalid_state"),
      { status: 302 }
    );
  }

  const redirectUri = `${process.env.NEXTAUTH_URL ?? ""}/api/auth/link-github/callback`;

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_ID ?? "",
      client_secret: process.env.GITHUB_SECRET ?? "",
      code: code ?? "",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "token_exchange_failed"),
      { status: 302 }
    );
  }

  const profileResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    const errorCode = profileResponse.status === 403 ? "rate_limited" : "github_profile_failed";
    return NextResponse.redirect(
      buildSettingsRedirect("error", errorCode),
      { status: 302 }
    );
  }

  const profile = (await profileResponse.json()) as GitHubUserResponse;

  if (String(profile.id) === session.githubId) {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "cannot_link_primary_account"),
      { status: 302 }
    );
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("github_id", session.githubId)
    .single();

  if (userError || !user) {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "user_not_found"),
      { status: 302 }
    );
  }

  const { encrypted, iv } = encryptToken(accessToken);

  const { error: insertError } = await supabaseAdmin
    .from("user_github_accounts")
    .insert({
      user_id: user.id,
      github_id: String(profile.id),
      github_login: profile.login,
      access_token_encrypted: encrypted,
      access_token_iv: iv,
    });

  if (insertError?.code === "23505") {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "already_linked"),
      { status: 302 }
    );
  }

  if (insertError) {
    return NextResponse.redirect(
      buildSettingsRedirect("error", "insert_failed"),
      { status: 302 }
    );
  }

  const response = NextResponse.redirect(
    buildSettingsRedirect("success", "account_linked"),
    { status: 302 }
  );
  response.cookies.set("link_github_state", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}