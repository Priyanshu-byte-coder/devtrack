"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";
import {
  ExternalLink,
  LogOut,
  Menu,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react";
import AccountToggle from "@/components/AccountToggle";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import NotificationBell from "@/components/NotificationBell";
import OnboardingTour from "@/components/OnboardingTour";
import BoardWelcome from "@/components/dashboard/BoardWelcome";
import SyncDataButton from "@/components/SyncDataButton";
import ThemeToggle from "@/components/ThemeToggle";
import {
  APP_NAV,
  activeNavItem,
  isNavItemActive,
} from "@/components/shell/nav";
import { DashboardWidgetA11yProvider } from "@/components/dashboard/DashboardWidgetA11yContext";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import MobileTabBar from "@/components/shell/MobileTabBar";

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-2 font-pixel text-sm uppercase tracking-[0.14em] text-[var(--foreground)]"
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
      className="flex-1 space-y-4 overflow-y-auto px-3 py-3"
    >
      {APP_NAV.map((section) => (
        <div key={section.label} className={section.accent}>
          <p className="mb-1 flex items-center gap-2 px-2 font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            <span aria-hidden="true" className="h-2 w-2 bg-[var(--nav-c)]" />
            {section.label}
          </p>
          <ul className="space-y-px">
            {section.items.map((item) => {
              const active = isNavItemActive(item, pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-center gap-2 px-2 py-1.5 text-[13px] transition-colors ${
                      active
                        ? "bg-[var(--control)] font-semibold text-[var(--foreground)] shadow-[inset_3px_0_0_0_var(--nav-c)]"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-2 shrink-0 font-pixel text-[10px] text-[var(--nav-c)] ${
                        active
                          ? "px-blink"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      ▶
                    </span>
                    <Icon
                      className={`h-4 w-4 shrink-0 ${active || item.highlight ? "text-[var(--nav-c)]" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                    {item.highlight && (
                      <span
                        aria-label="Featured"
                        className="ml-auto font-pixel text-[10px] text-[#f2c14e]"
                      >
                        ★
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

/** "Player 1": your login, linking to your public card (or to going public). */
function PlayerChip({ publicLogin }: { publicLogin: string | null }) {
  const { data: session } = useSession();
  const login = session?.githubLogin;
  if (!login) return null;
  const href = publicLogin
    ? `/u/${publicLogin.toLowerCase()}`
    : "/dashboard/settings#settings-profile";
  return (
    <Link
      href={href}
      className="px-frame group mx-3 mt-3 flex items-center gap-3 bg-[var(--background)] p-2.5 transition-colors hover:bg-[var(--control)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, sized by the URL */}
      <img
        src={`https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=64`}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 bg-[var(--control)] [image-rendering:pixelated]"
      />
      <span className="min-w-0 flex-1">
        <span className="block font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--accent)]">
          Player 1
        </span>
        <span className="block truncate font-mono text-[13px] font-semibold text-[var(--foreground)]">
          @{login}
        </span>
        <span className="block text-[11px] text-[var(--muted-foreground)]">
          {publicLogin ? "View your player card" : "Go public to get a card"}
        </span>
      </span>
    </Link>
  );
}

/** Jump to anyone's player card from anywhere in the dashboard. */
function SidebarLookup() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  return (
    <form
      role="search"
      aria-label="Look up a developer"
      className="mx-3 mt-3"
      onSubmit={(event) => {
        event.preventDefault();
        const login = normalizeGitHubUsername(value.replace(/^@/, ""));
        if (!login) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        setValue("");
        router.push(`/u/${login.toLowerCase()}`);
      }}
    >
      <label htmlFor="sidebar-lookup" className="sr-only">
        GitHub username to look up
      </label>
      <div className="flex border-2 border-[var(--border)] bg-[var(--background)] focus-within:border-[var(--accent)]">
        <Search
          className="ml-2 h-3.5 w-3.5 shrink-0 self-center text-[var(--muted-foreground)]"
          aria-hidden="true"
        />
        <input
          id="sidebar-lookup"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          placeholder="Look up a dev"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          className="w-0 min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Look up"
          className="px-2 font-pixel text-[10px] text-[var(--accent)] hover:bg-[var(--control)]"
        >
          ▶
        </button>
      </div>
      {invalid && (
        <p role="alert" className="mt-1 text-[11px] text-[var(--destructive)]">
          That isn&apos;t a valid GitHub username.
        </p>
      )}
    </form>
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
    onLeaderboard: boolean;
    publicSince: string | null;
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
            onLeaderboard:
              data.is_public === true && data.leaderboard_opt_in === true,
            publicSince:
              typeof data.public_since === "string" ? data.public_since : null,
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
      <PlayerChip publicLogin={publicLogin} />
      <SidebarLookup />
      <SidebarNav pathname={pathname} />
      <div className="border-t border-[var(--border)] p-3">
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <div className="app-shell min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside
        data-tour="nav"
        className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:flex"
      >
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
            {current?.label ??
              (pathname.startsWith("/compare") ? "Compare" : "Dashboard")}
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
          // Private repository names live here: keep them out of Clarity
          // session replays (see ClarityScript).
          data-clarity-mask="True"
          // Bottom padding on phones keeps content clear of the tab bar.
          className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-6"
        >
          {settings?.onLeaderboard && pathname.startsWith("/dashboard") && (
            <BoardWelcome
              publicSince={settings.publicSince}
              onHidden={() =>
                setSettings((prev) =>
                  prev
                    ? { ...prev, isPublic: false, onLeaderboard: false }
                    : prev
                )
              }
            />
          )}
          <DashboardWidgetA11yProvider>{children}</DashboardWidgetA11yProvider>
        </main>
      </div>

      <MobileTabBar
        pathname={pathname}
        menuOpen={drawerOpen}
        onMenu={() => setDrawerOpen(true)}
      />

      {settings && !settings.seenOnboarding && <OnboardingTour />}
    </div>
  );
}
