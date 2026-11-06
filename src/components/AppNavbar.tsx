"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Gamepad2,
  Github,
  Globe2,
  Menu,
  Sparkles,
  Swords,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import DevLookup from "@/components/landing/arcade/DevLookup";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

/** The phone menu's stages: big tiles, each with a one-line pitch. */
type Stage = {
  href: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** Tile accent, as literal Tailwind classes so they survive purging. */
  tone: string;
};

const STAGES: Stage[] = [
  {
    href: "/leaderboard",
    label: "Leaderboard",
    blurb: "Global ranks",
    icon: Trophy,
    tone: "[--stage-c:#facc15]",
  },
  {
    href: "/compare",
    label: "Duel",
    blurb: "You vs a friend",
    icon: Swords,
    tone: "[--stage-c:#f87171]",
  },
  {
    href: "/top",
    label: "Top devs",
    blurb: "By language & country",
    icon: Globe2,
    tone: "[--stage-c:#38bdf8]",
  },
  {
    href: "/guides",
    label: "Guides",
    blurb: "Badges, streaks, score",
    icon: BookOpen,
    tone: "[--stage-c:#4ade80]",
  },
  {
    href: "/#features",
    label: "Power-ups",
    blurb: "Everything you get",
    icon: Gamepad2,
    tone: "[--stage-c:#c084fc]",
  },
  {
    href: "/wrapped",
    label: "Year in Code",
    blurb: "Your year as slides",
    icon: Sparkles,
    tone: "[--stage-c:#fb923c]",
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const SIGN_IN_HREF = "/api/auth/signin/github?callbackUrl=/dashboard";
const REPO_URL = "https://github.com/Priyanshu-byte-coder/devtrack";

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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;
    const el = document.getElementById(href.slice(hashIndex + 1));
    if (el) {
      e.preventDefault();
      setMobileOpen(false);
      el.scrollIntoView({ behavior: "smooth" });
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

  // While the menu is open: the page behind can't scroll, Escape closes it,
  // and focus starts on the first stage and returns to the button after.
  useEffect(() => {
    if (!mobileOpen) return;
    const toggle = toggleRef.current;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [mobileOpen]);

  const isAuthenticated = status === "authenticated" && Boolean(session);
  const isPublicProfileRoute = pathname.startsWith("/u/");

  const navItems = useMemo<NavItem[]>(
    () => [
      { href: "/#features", label: t("features") },
      { href: "/leaderboard", label: t("leaderboard") },
      { href: "/compare", label: t("compare") },
    ],
    [t]
  );

  // The signed-in app shell provides its own navigation.
  if (pathname === "/wrapped" || pathname.startsWith("/dashboard")) return null;

  const primaryAction = isAuthenticated ? (
    <Link href="/dashboard" className="px-btn px-btn-sm">
      {t("openDashboard")}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  ) : isPublicProfileRoute ? null : (
    <Link href={SIGN_IN_HREF} prefetch={false} className="px-btn px-btn-sm">
      {t("signInCta")}
    </Link>
  );

  return (
    <>
      <header
        className={cn(
          "site-navbar sticky top-0 z-50 border-b transition-colors duration-200",
          scrolled || mobileOpen
            ? "border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_85%,transparent)] backdrop-blur"
            : "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href={isAuthenticated ? "/dashboard" : "/"}
            className="inline-flex select-none items-center gap-2 font-pixel text-sm uppercase tracking-[0.14em] text-[var(--foreground)]"
          >
            <span className="flex h-7 w-7 items-center justify-center bg-accent/10 text-sm text-[var(--accent)]">
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
                    "px-3 py-1.5 font-pixel text-xs uppercase tracking-[0.1em] transition-colors",
                    active
                      ? "text-[var(--accent)]"
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
            ref={toggleRef}
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="px-frame inline-flex h-9 items-center gap-2 bg-[var(--card)] px-3 font-pixel text-[11px] uppercase tracking-[0.12em] text-[var(--card-foreground)] transition-transform active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="app-mobile-nav"
            aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
            <span aria-hidden="true">{mobileOpen ? "Close" : "Menu"}</span>
          </button>
        </div>
      </header>

      {/* Outside the header: its backdrop blur would make it the containing
          block for this fixed overlay and squash it to the header height. */}
      {mobileOpen && (
        <div
          id="app-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label={t("main")}
          className="fixed inset-x-0 bottom-0 top-14 z-50 md:hidden"
        >
          {/* Tapping outside the panel closes it. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
            className="mobile-menu-backdrop absolute inset-0 h-full w-full cursor-default bg-black/55 backdrop-blur-[2px]"
          />
          <div
            ref={panelRef}
            className="mobile-menu-panel px-grid-bg relative max-h-full overflow-y-auto overscroll-contain border-b-4 border-[var(--accent)] bg-[var(--background)] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
          >
            <p className="font-pixel text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              <span aria-hidden="true" className="px-blink mr-1.5">
                ▶
              </span>
              Select stage
            </p>

            <nav aria-label={t("main")} className="mt-3">
              <ul className="grid grid-cols-2 gap-3">
                {STAGES.map(({ href, label, blurb, icon: Icon, tone }, i) => {
                  const active = isActivePath(pathname, href);
                  return (
                    <li
                      key={href}
                      className="mobile-menu-tile"
                      style={{ animationDelay: `${60 + i * 40}ms` }}
                    >
                      <Link
                        href={href}
                        onClick={(e) => handleAnchorClick(e, href)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "stage-tile px-frame flex min-h-[5.5rem] flex-col justify-between bg-[var(--card)] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                          tone,
                          active && "px-frame-accent"
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span className="stage-tile__icon flex h-8 w-8 items-center justify-center">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span
                            aria-hidden="true"
                            className="font-pixel text-[10px] text-[var(--muted-foreground)]"
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        </span>
                        <span>
                          <span className="block font-pixel text-xs uppercase tracking-[0.08em] text-[var(--card-foreground)]">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                            {blurb}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <DevLookup className="mt-6" />

            <div className="mt-5 flex flex-col gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard" className="px-btn w-auto">
                  {t("openDashboard")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <Link href={SIGN_IN_HREF} prefetch={false} className="px-btn">
                  <Github className="h-4 w-4" aria-hidden="true" />
                  Sign in with GitHub
                </Link>
              )}
              <div className="flex items-center justify-between gap-3 border-t-4 border-dotted border-[var(--border)] pt-4">
                <span className="flex items-center gap-2 font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  Theme <ThemeToggle variant="compact" />
                </span>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <Github className="h-3.5 w-3.5" aria-hidden="true" />
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
