import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { validateCronRequest } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const lastSyncedAt = url.searchParams.get("lastSyncedAt");

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "No GitHub token configured" }, { status: 500 });
  }

  const targetOwner = "Priyanshu-byte-coder";
  const currentTimestamp = new Date().toISOString();

  // 🧠 INCREMENTAL CHECKPOINT LAYER: Avoids duplicate sync loops if executed within an aggressive window
  if (lastSyncedAt) {
    try {
      const syncThresholdMs = 5 * 60 * 1000; // 5-minute incremental safety delta
      const lastSyncTime = new Date(lastSyncedAt).getTime();
      const currentSyncTime = new Date(currentTimestamp).getTime();

      if (!isNaN(lastSyncTime) && (currentSyncTime - lastSyncTime < syncThresholdMs)) {
        return NextResponse.json({
          success: true,
          isIncremental: true,
          message: "Data synchronization skipped. Checkpoint is up to date.",
          synchronizedAt: currentTimestamp
        });
      }
    } catch (e) {
      console.warn("Invalid lastSyncedAt timestamp parameter provided, falling back to full baseline pass.");
    }
  }

  try {
    const query = `
      query {
        user(login: "${targetOwner}") {
          sponsorshipsAsMaintainer(first: 100) {
            nodes {
              sponsorEntity {
                ... on User {
                  login
                }
                ... on Organization {
                  login
                }
              }
            }
          }
        }
      }
    `;

    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch sponsors:", res.status);
      return NextResponse.json({ error: "GitHub API error" }, { status: 502 });
    }

    const { data, errors } = await res.json();

    if (errors && errors.length > 0) {
      console.error("GraphQL errors:", errors);
      return NextResponse.json({ error: "GraphQL query failed" }, { status: 502 });
    }

    if (!data || !data.user) {
      console.error("GraphQL returned empty data or null user");
      return NextResponse.json({ error: "GraphQL query returned no user data" }, { status: 502 });
    }

    const sponsorLogins: string[] = [];

    if (data.user.sponsorshipsAsMaintainer?.nodes) {
      const nodes = data.user.sponsorshipsAsMaintainer.nodes;
      for (const node of nodes) {
        if (node.sponsorEntity?.login) {
          sponsorLogins.push(node.sponsorEntity.login);
        }
      }
    }

    const { data: currentSponsors, error: fetchErr } = await supabaseAdmin
      .from("users")
      .select("github_login")
      .eq("is_sponsor", true);

    if (fetchErr) {
      console.error("Failed to fetch current sponsors:", fetchErr);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const currentLogins = new Set<string>(
      (currentSponsors || []).map((u: any) => String(u.github_login))
    );
    const newLogins = new Set<string>(sponsorLogins);

    const toRemove = [...currentLogins].filter((login: string) => !newLogins.has(login));
    const toAdd = [...newLogins].filter((login: string) => !currentLogins.has(login));

    let updatesCount = 0;

    if (toRemove.length > 0) {
      const { error } = await supabaseAdmin
        .from("users")
        .update({ is_sponsor: false })
        .in("github_login", toRemove);

      if (error) {
        console.error("Failed to remove sponsors:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
      updatesCount += toRemove.length;
    }

    if (toAdd.length > 0) {
      const { error } = await supabaseAdmin
        .from("users")
        .update({ is_sponsor: true })
        .in("github_login", toAdd);

      if (error) {
        console.error("Failed to add sponsors:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
      updatesCount += toAdd.length;
    }

    return NextResponse.json({
      success: true,
      isIncremental: false,
      updatesCount,
      sponsorCount: sponsorLogins.length,
      synchronizedAt: currentTimestamp,
      sponsors: sponsorLogins
    });
  } catch (error) {
    console.error("Error in sponsors sync:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

