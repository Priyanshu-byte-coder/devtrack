import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveAppUser, AppUser } from "@/lib/resolve-user";
import { generateSecretKey, encryptSecretKey } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

async function requireUser(): Promise<{ user: AppUser } | { error: Response }> {
  const session = await getServerSession(authOptions);

  if (!session?.githubId || !session?.githubLogin) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);

  if (!userRow) {
    return { error: Response.json({ error: "User not found" }, { status: 404 }) };
  }

  return { user: userRow };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireUser();
  if ("error" in result) return result.error;

  const { id } = await params;

  const { data: webhook } = await supabaseAdmin
    .from("webhook_configs")
    .select("id")
    .eq("id", id)
    .eq("user_id", result.user.id)
    .single();

  if (!webhook) {
    return Response.json({ error: "Webhook not found" }, { status: 404 });
  }

  const newSecretKey = generateSecretKey();
  const { encrypted, iv } = encryptSecretKey(newSecretKey);

  const { data: updated, error } = await supabaseAdmin
    .from("webhook_configs")
    .update({
      secret_key: encrypted,
      secret_iv: iv,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", result.user.id)
    .select("id, name")
    .single();

  if (error) {
    console.error("Error rotating secret:", error);
    return Response.json(
      { error: "Failed to rotate secret key" },
      { status: 500 }
    );
  }

  return Response.json({
    webhook: updated,
    secretKey: newSecretKey,
    message: "Secret key rotated. Store this new key securely. It will not be shown again.",
  });
}
