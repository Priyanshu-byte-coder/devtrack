"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import {
  ExternalLink,
  LogOut,
  Menu,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import AccountToggle from "@/components/AccountToggle";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTour from "@/components/OnboardingTour";
import SyncDataButton from "@/components/SyncDataButton";
import ThemeToggle from "@/components/ThemeToggle";
import {
  APP_NAV,
  activeNavItem,
  isNavItemActive,
} from "@/components/shell/nav";
import { DashboardWidgetA11yProvider } from "@/components/dashboard/DashboardWidgetA11yContext";

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-2 text-sm font-bold tracking-[0.18em] text-[var(--foreground)]"
      style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)" }}
    >
      <span className="text-[var(--accent)]" aria-hidden="true">
        ▲
      </span>
      DEVTRACK
    </Link>
  );
}

function SidebarNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Dashboard"
      className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
    >
      {APP_NAV.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label && (
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {section.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isNavItemActive(item, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-accent/10 font-medium text-[var(--accent)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${item.highlight ? "text-violet-400" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                    {item.highlight && (
                      <span className="ml-auto rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-400">
                        New
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu({ publicLogin }: { publicLogin: string | null }) {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.githubLogin || "Account";
  const login = session?.githubLogin;
  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-lg p-1 pr-2 hover:bg-[var(--control)] [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        {login ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              session?.user?.image ||
              `https://avatars.githubusercontent.com/${login}?s=64`
            }
            alt=""
            className="h-7 w-7 rounded-full bg-[var(--control)]"
          />
        ) : (
          <UserRound className="h-5 w-5" aria-hidden="true" />
        )}
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">
          {name}
        </span>
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 text-sm shadow-lg">
        {publicLogin && (
          <Link
            href={`/u/${publicLogin.toLowerCase()}`}
            className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--control)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Public profile
          </Link>
        )}
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--control)]"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </Link>
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--destructive)] hover:bg-[var(--control)]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </details>
  );
}

/**
 * Signed-in app frame: sidebar navigation (drawer on mobile) and a slim top
 * bar. Every dashboard tab renders inside it.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settings, setSettings] = useState<{
    isPublic: boolean;
    seenOnboarding: boolean;
  } | null>(null);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/user/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data)
          setSettings({
            isPublic: data.is_public === true,
            seenOnboarding: data.seen_onboarding === true,
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session]);

  const current = activeNavItem(pathname);
  const publicLogin = settings?.isPublic
    ? (session?.githubLogin ?? null)
    : null;

  const sidebar = (
    <>
      <div className="flex h-14 items-center border-b border-[var(--border)] px-3">
        <Brand />
      </div>
      <SidebarNav pathname={pathname} />
      <div className="border-t border-[var(--border)] p-3">
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:flex">
        {sidebar}
      </aside>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--card)]">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-3 rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--control)]"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
            <div className="border-t border-[var(--border)] px-3 pb-3 md:hidden">
              <AccountToggle />
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header
          role="banner"
          className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_85%,transparent)] px-4 backdrop-blur sm:px-6 lg:px-8"
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="-ml-2 rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--control)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="truncate text-sm font-medium text-[var(--muted-foreground)]">
            {current?.label ?? "Dashboard"}
          </p>
          <div className="hidden min-w-0 overflow-x-auto md:block [&>div]:mt-0 [&>div]:flex-nowrap">
            <AccountToggle />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <SyncDataButton />
            <div className="hidden sm:block">
              <KeyboardShortcuts />
            </div>
            <NotificationBell />
            <AccountMenu publicLogin={publicLogin} />
          </div>
        </header>

        <main
          id="dashboard-main"
          className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
        >
          <DashboardWidgetA11yProvider>{children}</DashboardWidgetA11yProvider>
        </main>
      </div>

      {settings && !settings.seenOnboarding && <OnboardingTour />}
    </div>
  );
}
