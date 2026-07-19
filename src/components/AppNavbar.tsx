"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { useTranslations } from "next-intl";

type NavItem = { href: string; label: string };

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.includes("#")) {
    const [base] = href.split("#");
    return pathname === base;
  }
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const MONO = "var(--font-jetbrains, ui-monospace, monospace)";

// AppNavbar component provides a persistent, responsive navigation bar
// for improved app-wide navigation and discoverability.
// Features included: Logo, Navigation links, Auth state handling, Active state indicators, and Mobile hamburger menu.
export default function AppNavbar() {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;
    const id = href.slice(hashIndex + 1);
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [pathname]);

  const isAuthenticated = status === "authenticated" && Boolean(session);
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isPublicProfileRoute = pathname.startsWith("/u/");
  const identityLabel =
    session?.githubLogin ?? session?.user?.name ?? session?.user?.email ?? "user";

  const navItems = useMemo<NavItem[]>(() => {
    if (isAuthenticated) {
      return [
        { href: "/dashboard", label: t("overview") },
        { href: "/dashboard/career-intelligence", label: t("resume") },
        { href: "/dashboard/personality", label: t("personality") },
        { href: "/leaderboard", label: t("leaderboard") },
      ];
    }
    return [
      { href: "/", label: t("home") },
      { href: "/#features", label: t("features") },
      { href: "/leaderboard", label: t("leaderboard") },
    ];
  }, [isAuthenticated, t]);

  // The wrapped experience provides its own navigation
  if (pathname === "/wrapped") return null;

  const headerStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: scrolled ? "color-mix(in srgb, var(--background) 75%, transparent)" : "transparent",
    backdropFilter: scrolled ? "blur(24px) saturate(150%)" : "none",
    WebkitBackdropFilter: scrolled ? "blur(24px) saturate(150%)" : "none",
    borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return (
    <header style={headerStyle}>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">

        {/* Logo / brand - Links to homepage or dashboard */}
        <Link
          href={isAuthenticated ? "/dashboard" : "/"}
          className="group inline-flex items-center gap-2.5 select-none transition-transform duration-300 hover:scale-[1.02]"
          style={{ fontFamily: MONO }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-base font-bold text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)]/20">
            ▲
          </span>
          <span className="text-sm font-bold tracking-[0.2em] text-[var(--foreground)]">
            DEVTRACK
          </span>
        </Link>

        {/* Desktop nav - Includes links to Dashboard, Streaks, Pull Requests, Goals, etc. */}
        <nav className="hidden items-center gap-1 md:flex rounded-full border border-white/5 bg-white/[0.02] px-2 py-1.5 shadow-sm" aria-label={t("main")}>
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleAnchorClick(e, item.href)}
                className="relative px-3 py-2 text-[12px] font-medium transition-colors duration-150"
                style={{
                  fontFamily: MONO,
                  color: active ? "var(--accent)" : "var(--muted-foreground)",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "var(--foreground)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.color = "var(--muted-foreground)";
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop right */}
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          {/* Show ThemeToggle in navbar except on dashboard, where DashboardHeader provides it */}
          {!isDashboardRoute && <ThemeToggle variant="compact" />}
          {/* Auth state - Shows user identity and settings when logged in, or generic sign-in when logged out */}
          {isAuthenticated ? (
            !isDashboardRoute && (
              <div className="flex items-center gap-4 border-l border-white/10 pl-4">
                <Link
                  href="/dashboard/settings"
                  className="text-[12px] font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                  style={{ fontFamily: MONO }}
                >
                  ⚙️ {t("settings")}
                </Link>
                <div className="flex items-center gap-3">
                  <span
                    className="hidden max-w-[140px] truncate text-[12px] font-medium text-[var(--foreground)] lg:block"
                    style={{ fontFamily: MONO }}
                  >
                    @{identityLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-lg bg-red-500/10 px-3 py-1.5 text-[12px] font-medium text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300"
                    style={{ fontFamily: MONO }}
                  >
                    {t("signOutCta")}
                  </button>
                </div>
              </div>
            )
          ) : (
            !isPublicProfileRoute && (
              <Link
                href="/api/auth/signin/github?callbackUrl=/dashboard"
                className="shrink-0 rounded-full px-5 py-2 text-[13px] font-semibold text-[var(--accent-foreground)] shadow-[0_0_20px_rgba(129,140,248,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_25px_rgba(129,140,248,0.5)]"
                style={{ fontFamily: MONO, background: "var(--accent)" }}
              >
                {t("signInCta")} →
              </Link>
            )
          )}
        </div>

        {/* Mobile hamburger menu - Collapses links into a dropdown for smaller viewports */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2.5 text-[var(--foreground)] transition-colors hover:bg-white/10 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="app-mobile-nav"
          aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id="app-mobile-nav"
          className="border-t border-[var(--border)] md:hidden"
          style={{ background: "color-mix(in srgb, var(--background) 98%, transparent)", backdropFilter: "blur(24px)" }}
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 sm:px-6">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleAnchorClick(e, item.href)}
                  className="rounded-lg px-4 py-3 text-sm font-medium transition-colors"
                  style={{
                    fontFamily: MONO,
                    color: active ? "var(--accent)" : "var(--muted-foreground)",
                    background: active ? "var(--accent-soft)" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}

            {isAuthenticated && (
              <Link
                href="/dashboard/settings"
                className="rounded-xl px-4 py-3.5 text-sm font-medium text-[var(--muted-foreground)] hover:bg-white/5 transition-colors"
                style={{ fontFamily: MONO }}
              >
                {t("settings")}
              </Link>
            )}

            <div className="mt-4 border-t border-white/10 pt-4">
              {!isDashboardRoute && (
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm font-medium text-[var(--muted-foreground)]" style={{ fontFamily: MONO }}>
                    Theme
                  </span>
                  <ThemeToggle variant="compact" />
                </div>
              )}
              {isAuthenticated ? (
                !isDashboardRoute && (
                  <div className="flex flex-col gap-3">
                    <p className="px-4 py-2 text-[12px] text-[var(--muted-foreground)]" style={{ fontFamily: MONO }}>
                      {t("loggedInAs")} <span className="font-semibold text-[var(--foreground)]">@{identityLabel}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full rounded-xl bg-red-500/10 px-4 py-3.5 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                      style={{ fontFamily: MONO }}
                    >
                      {t("signOutCta")} →
                    </button>
                  </div>
                )
              ) : (
                !isPublicProfileRoute && (
                  <Link
                    href="/api/auth/signin/github?callbackUrl=/dashboard"
                    className="block w-full rounded-xl px-4 py-3.5 text-center text-sm font-semibold text-[var(--accent-foreground)] shadow-lg"
                    style={{ background: "var(--accent)", fontFamily: MONO }}
                  >
                    {t("signInCta")} →
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}