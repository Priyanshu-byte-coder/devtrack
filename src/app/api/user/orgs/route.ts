import { getServerSession } from "next-auth";
import { getAccessToken } from "@/lib/get-session-token";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { getAllAccounts } from "@/lib/github-accounts";

export const dynamic = "force-dynamic";

interface GitHubOrg {
  login: string;
  id: number;
  avatar_url: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
  const accessToken = await getAccessToken();

    if (!session?.githubId || !accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRow = await resolveAppUser(session.githubId, session.githubLogin);
    let config = {};
    let allAccounts: any[] = [];

    if (userRow) {
      // Load user settings to get the saved config
      const { data: dbUser, error: dbError } = await supabaseAdmin
        .from("users")
        .select("organizations_config")
        .eq("id", userRow.id)
        .single();

      if (!dbError && dbUser) {
        config = dbUser.organizations_config || {};
      }

      // Get all accounts (primary and linked) to fetch orgs for all of them
      allAccounts = await getAllAccounts(
        {
          token: accessToken,
          githubId: session.githubId,
          githubLogin: session.githubLogin || "",
        },
        userRow.id
      );
    } else {
      // Fallback if Supabase is unavailable (or mock login): use active session details
      allAccounts = [
        {
          token: accessToken,
          githubId: session.githubId,
          githubLogin: session.githubLogin || "",
          orgs: [
            {
              id: 9999,
              login: "devtrack-org",
              avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
            }
          ],
          hasOrgScope: false,
          mocked: true,
        },
      ];
    }

    const accountsData = await Promise.all(
      allAccounts.map(async (acc) => {
        try {
          if (acc.mocked) {
            return {
              githubId: acc.githubId,
              githubLogin: acc.githubLogin,
              orgs: acc.orgs,
              hasOrgScope: acc.hasOrgScope,
            };
          }
          // Fetch the organizations for this account token
          const res = await fetch("https://api.github.com/user/orgs", {
            headers: {
              Authorization: `Bearer ${acc.token}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          });

          if (!res.ok) {
            return {
              githubId: acc.githubId,
              githubLogin: acc.githubLogin,
              orgs: [],
              hasOrgScope: false,
            };
          }

          const scopesHeader = res.headers.get("X-OAuth-Scopes") || "";
          const hasOrgScope = scopesHeader
            .split(",")
            .map((s) => s.trim())
            .includes("read:org");

          const orgs = (await res.json()) as GitHubOrg[];

          return {
            githubId: acc.githubId,
            githubLogin: acc.githubLogin,
            orgs: orgs.map((o) => ({
              id: o.id,
              login: o.login,
              avatarUrl: o.avatar_url,
            })),
            hasOrgScope,
          };
        } catch (err) {
          return {
            githubId: acc.githubId,
            githubLogin: acc.githubLogin,
            orgs: [],
            hasOrgScope: false,
          };
        }
      })
    );

    return NextResponse.json({
      accounts: accountsData,
      config,
    });
  } catch (error) {
    console.error("Error in /api/user/orgs GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.githubId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRow = await resolveAppUser(session.githubId, session.githubLogin);
    const { config } = (await req.json()) as { config: Record<string, any> };

    if (!config || typeof config !== "object") {
      return NextResponse.json({ error: "Invalid configuration" }, { status: 400 });
    }

    if (!userRow) {
      // Graceful fallback if Supabase is unavailable (e.g. local dev mock login)
      return NextResponse.json({ success: true });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        organizations_config: config,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userRow.id);

    if (error) {
      console.error("Error updating organizations_config:", error);
      return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in /api/user/orgs POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
