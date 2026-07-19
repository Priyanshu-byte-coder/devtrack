import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser } from "@/lib/resolve-user";
import { randomBytes, createHash } from "crypto";

export const dynamic = "force-dynamic";

const MAX_KEYS_PER_USER = 10;

// lgtm[js/insufficient-password-hash] - SHA-256 is appropriate for hashing high-entropy random API keys, not passwords
function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { data: keys, error } = await supabaseAdmin
    .from("local_coding_api_keys")
    .select("id, name, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch local coding API keys:", error);
    return Response.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }

  return Response.json({ keys: keys ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  let body: { name?: string };
  try {
    body = await req.json();
  } catch (e) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }

  const { count: existingCount } = await supabaseAdmin
    .from("local_coding_api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((existingCount || 0) >= MAX_KEYS_PER_USER) {
    return Response.json(
      { error: `API key limit reached. Maximum ${MAX_KEYS_PER_USER} keys per user.` },
      { status: 400 }
    );
  }

  const apiKey = randomBytes(24).toString("base64url");
  const apiKeyHash = hashApiKey(apiKey);

  const { count: latestCount } = await supabaseAdmin
    .from("local_coding_api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  
  if ((latestCount || 0) >= MAX_KEYS_PER_USER) {
    return Response.json(
      { error: `API key limit reached. Maximum ${MAX_KEYS_PER_USER} keys per user.` },
      { status: 400 }
    );
  }

  const { data: keyRecord, error } = await supabaseAdmin
    .from("local_coding_api_keys")
    .insert({
      user_id: user.id,
      api_key: apiKey.slice(0, 8),
      api_key_hash: apiKeyHash,
      name,
    })
    .select("id, name, last_used_at, created_at")
    .single();

  if (error) {
    console.error("Error creating API key:", error);
    return Response.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }

  return Response.json({
    key: { ...keyRecord, api_key: apiKey },
    message: "Store this API key securely. It will not be shown again.",
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.githubId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const keyId = searchParams.get("id");

  if (!keyId) {
    return Response.json({ error: "Key ID is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("local_coding_api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting API key:", error);
    return Response.json({ error: "Failed to delete key" }, { status: 500 });
  }

  return Response.json({ success: true });
}