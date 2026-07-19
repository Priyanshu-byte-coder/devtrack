import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendTestNotification } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.githubLogin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { webhookUrl } = await req.json();

    if (!webhookUrl || typeof webhookUrl !== "string" || (!webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.startsWith("https://discordapp.com/api/webhooks/"))) {
      return NextResponse.json({ error: "Invalid Discord Webhook URL" }, { status: 400 });
    }

    await sendTestNotification(webhookUrl, session.githubLogin);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Discord test notification error:", error);
    return NextResponse.json({ error: error.message || "Failed to send notification" }, { status: 500 });
  }
}
