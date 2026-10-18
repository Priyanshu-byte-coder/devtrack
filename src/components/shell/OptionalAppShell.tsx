import type { ReactNode } from "react";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/shell/AppShell";

/**
 * Layout for pages that are public but also part of the signed-in app
 * (leaderboard, compare, Year in Code): signed-in visitors keep the app
 * sidebar, everyone else gets the marketing page frame.
 */
export default async function OptionalAppShell({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session) return <AppShell>{children}</AppShell>;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {children}
    </main>
  );
}
