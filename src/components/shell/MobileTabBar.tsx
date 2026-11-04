"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Menu,
  Swords,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  /** Also lights up on these routes. */
  match?: (pathname: string) => boolean;
}> = [
  {
    href: "/dashboard",
    label: "HQ",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard",
  },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/compare", label: "Duel", icon: Swords },
  { href: "/dashboard/goals", label: "Goals", icon: Target },
];

const tabClass =
  "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 font-pixel text-[10px] uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] active:translate-y-px";

/**
 * Bottom tab bar for the signed-in app on phones and tablets: the four
 * places people go most, one thumb away, and Menu for the rest (the drawer).
 */
export default function MobileTabBar({
  pathname,
  onMenu,
  menuOpen,
}: {
  pathname: string;
  onMenu: () => void;
  menuOpen: boolean;
}) {
  return (
    <nav
      aria-label="Quick navigation"
      className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 flex border-t-4 border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match
          ? match(pathname)
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              tabClass,
              active
                ? "text-[var(--accent)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
          >
            {/* The current tab gets a pixel bar along the top edge. */}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-4 -top-1 h-1 bg-[var(--accent)]"
              />
            )}
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-label="Open the full menu"
        className={cn(
          tabClass,
          "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        )}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
        Menu
      </button>
    </nav>
  );
}
