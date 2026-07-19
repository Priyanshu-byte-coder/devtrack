import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { supabaseAdmin } from "@/lib/supabase";
import {
    getDefaultDashboardLayout,
    normalizeDashboardLayout,
} from "@/lib/dashboard-layout";

export async function GET() {
    try {
          const session = await getServerSession(authOptions);

      if (!session?.githubId) {
              return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const appUser = await resolveAppUser(session.githubId, session.githubLogin);

      if (!appUser) {
              return NextResponse.json({ layout: getDefaultDashboardLayout(), source: "default" });
      }

      const { data, error } = await supabaseAdmin
            .from("users")
            .select("dashboard_layout")
            .eq("id", appUser.id)
            .single();

      if (error) {
              return NextResponse.json({
                        layout: getDefaultDashboardLayout(),
                        source: "default",
              });
      }

      return NextResponse.json({
              layout: normalizeDashboardLayout(data?.dashboard_layout),
              source: "database",
      });
    } catch {
          return NextResponse.json({
                  layout: getDefaultDashboardLayout(),
                  source: "fallback",
          });
    }
}

export async function PATCH(request: Request) {
    try {
          const session = await getServerSession(authOptions);

      if (!session?.githubId) {
              return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = (await request.json()) as { layout?: unknown };
          const layout = normalizeDashboardLayout(body.layout);

      const appUser = await resolveAppUser(session.githubId, session.githubLogin);

      if (!appUser) {
              return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
                      );
      }

      const { error } = await supabaseAdmin
            .from("users")
            .update({
                      dashboard_layout: layout,
                      updated_at: new Date().toISOString(),
            })
            .eq("id", appUser.id);

      if (error) {
              return NextResponse.json(
                { error: "Failed to save dashboard layout" },
                { status: 500 },
                      );
      }

      return NextResponse.json({ layout });
    } catch {
          return NextResponse.json(
            { error: "Failed to save dashboard layout" },
            { status: 500 },
                );
    }
}
