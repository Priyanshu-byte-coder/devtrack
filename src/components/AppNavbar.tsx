"use client";

import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIGN_IN_HREF = "/api/auth/signin/github?callbackUrl=/dashboard";

/**
 * Header for public pages (landing, legal, docs, public profiles). Signed-in
 * pages use the app shell instead and hide this header.
 */
export default function AppNavbar() {
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;
    const el = document.getElementById(href.slice(hashIndex + 1));
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth" });
      setMobileOpen(false);
    }
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [pathname]);

  const isAuthenticated = status === "authenticated" && Boolean(session);
  const isPublicProfileRoute = pathname.startsWith("/u/");

  const navItems = useMemo<NavItem[]>(
    () => [
      { href: "/#features", label: t("features") },
      { href: "/leaderboard", label: t("leaderboard") },
    ],
    [t]
  );

  // The signed-in app shell provides its own navigation.
  if (pathname === "/wrapped" || pathname.startsWith("/dashboard")) return null;

  const primaryAction = isAuthenticated ? (
    <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
      {t("openDashboard")}
      <ArrowRight aria-hidden="true" />
    </Link>
  ) : isPublicProfileRoute ? null : (
    <Link
      href={SIGN_IN_HREF}
      prefetch={false}
      className={buttonVariants({ size: "sm" })}
    >
      {t("signInCta")}
    </Link>
  );

  return (
    <header
      className={cn(
        "site-navbar sticky top-0 z-50 border-b transition-colors duration-200",
        scrolled
          ? "border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_85%,transparent)] backdrop-blur"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href={isAuthenticated ? "/dashboard" : "/"}
          className="inline-flex select-none items-center gap-2 text-sm font-bold tracking-[0.18em] text-[var(--foreground)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-sm text-[var(--accent)]">
            ▲
          </span>
          DEVTRACK
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label={t("main")}
        >
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleAnchorClick(e, item.href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <ThemeToggle variant="compact" />
          {primaryAction}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className={buttonVariants({
            variant: "ghost",
            size: "icon",
            className: "md:hidden",
          })}
          aria-expanded={mobileOpen}
          aria-controls="app-mobile-nav"
          aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="app-mobile-nav"
          className="border-t border-[var(--border)] bg-[var(--background)] md:hidden"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleAnchorClick(e, item.href)}
                className="rounded-md px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--control)] hover:text-[var(--foreground)]"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
              <ThemeToggle variant="compact" />
              {primaryAction}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
