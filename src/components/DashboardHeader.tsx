"use client";
import React from "react";
import NotificationBell from "@/components/NotificationBell";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import ShareProfileButton from "@/components/ShareProfileButton";
import { useSession } from "next-auth/react";
import AccountToggle from "@/components/AccountToggle";
import SignOutButton from "@/components/SignOutButton";
import ThemeToggle from "@/components/ThemeToggle";
import UserAvatar from "@/components/UserAvatar";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import OnboardingTour from "@/components/OnboardingTour";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button, buttonVariants } from "@/components/ui/button";

type DashboardSyncContextValue = {
  lastSynced: Date | null;
};

const DashboardSyncContext = createContext<DashboardSyncContextValue>({
  lastSynced: null,
});

interface CacheEntry {
  data: any;
  timestamp: number;
  headers: [string, string][];
  status: number;
  statusText: string;
}

const clientCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<Response>>();

const STALE_TIMES: Record<string, number> = {
  "/api/metrics/prs": 5 * 60 * 1000,
  "/api/metrics/weekly-summary": 5 * 60 * 1000,
  "/api/metrics/streak": 5 * 60 * 1000,
  "/api/metrics/contributions": 5 * 60 * 1000,
  "/api/metrics/repos": 5 * 60 * 1000,
  "/api/metrics/languages": 5 * 60 * 1000,
  "/api/notifications": 1 * 60 * 1000,
  "default": 2 * 60 * 1000,
};

function getStaleTime(url: string): number {
  const path = url.split("?")[0];
  for (const [key, value] of Object.entries(STALE_TIMES)) {
    if (path.endsWith(key) || path.includes(key)) {
      return value;
    }
  }
  return STALE_TIMES["default"];
}

function getRequestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input.startsWith("http") ? new URL(input).pathname : input;
  }

  if (input instanceof URL) {
    return input.pathname;
  }

  return new URL(input.url).pathname;
}

function isDashboardDataRequest(input: RequestInfo | URL): boolean {
  const requestPath = getRequestPath(input);

  return (
    requestPath.startsWith("/api/metrics/") ||
    requestPath === "/api/goals" ||
    requestPath.startsWith("/api/goals/") ||
    requestPath.startsWith("/api/streak/") ||
    requestPath === "/api/user/github-accounts" ||
    requestPath.startsWith("/api/badge/") ||
    requestPath.startsWith("/api/notifications") ||
    requestPath.startsWith("/api/user/settings") ||
    requestPath.startsWith("/api/ai-insights")
  );
}

export function DashboardSyncProvider({ children }: { children: ReactNode }) {
  const [lastSynced, setLastSynced] = useState<Date | null>(() => {
    const stored = localStorage.getItem("devtrack-last-synced");
    return stored ? new Date(stored) : null;
  });

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    const handleSync = () => {
      console.log("[Client Cache] Invalidating dashboard metrics cache due to sync event.");
      clientCache.clear();
    };

    window.addEventListener("devtrack:sync", handleSync);
    return () => {
      window.removeEventListener("devtrack:sync", handleSync);
    };
  }, []);

  useLayoutEffect(() => {
    if (process.env.NODE_ENV === "test") return;
    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const isGet = !init || !init.method || init.method.toUpperCase() === "GET";

      if (isDashboardDataRequest(input)) {
        if (!isGet) {
          // Clear cache on write requests (POST, PUT, DELETE, PATCH)
          console.log("[Client Cache] Invalidate cache due to mutation request:", url);
          clientCache.clear();
          return originalFetch(input, init);
        }

        const cacheKey = url;
        const now = Date.now();
        const cached = clientCache.get(cacheKey);
        const staleTime = getStaleTime(url);

        let pending = pendingRequests.get(cacheKey);

        const doFetch = async () => {
          try {
            const response = await originalFetch(input, init);
            if (response.ok) {
              const clone = response.clone();
              const json = await clone.json();
              clientCache.set(cacheKey, {
                data: json,
                timestamp: Date.now(),
                headers: Array.from(response.headers.entries()),
                status: response.status,
                statusText: response.statusText,
              });

              const nowTime = new Date();
              setLastSynced(nowTime);
              localStorage.setItem("devtrack-last-synced", nowTime.toISOString());
            }
            return response;
          } catch (error) {
            throw error;
          } finally {
            pendingRequests.delete(cacheKey);
          }
        };

        if (cached) {
          const isStale = now - cached.timestamp > staleTime;
          if (isStale) {
            if (!pending) {
              pending = doFetch();
              pendingRequests.set(cacheKey, pending);
            }
          }
          return new Response(JSON.stringify(cached.data), {
            status: cached.status,
            statusText: cached.statusText,
            headers: new Headers(cached.headers),
          });
        }

        if (!pending) {
          pending = doFetch();
          pendingRequests.set(cacheKey, pending);
        }
        return (await pending).clone();
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const value = useMemo(() => ({ lastSynced }), [lastSynced]);

  return (
    <DashboardSyncContext.Provider value={value}>
      {children}
    </DashboardSyncContext.Provider>
  );
}

function useDashboardSync() {
  return useContext(DashboardSyncContext);
}

export default function DashboardHeader() {
  const { data: session } = useSession();
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [seenOnboarding, setSeenOnboarding] = useState<boolean>(true);
  const [greeting, setGreeting] = useState<string>("Welcome back");

  const [isNightOwl, setIsNightOwl] = useState<boolean>(false);
  const [isEarlyBird, setIsEarlyBird] = useState<boolean>(false);

  useEffect(() => {
    const computeCurrentGreeting = () => {
      const currentHour = new Date().getHours();
      if (currentHour >= 5 && currentHour < 12) return "Good morning ☀️";
      if (currentHour >= 12 && currentHour < 17) return "Good afternoon 🌤️";
      if (currentHour >= 17 && currentHour < 22) return "Good evening 🌙";
      return "Burning the midnight oil 🦉";
    };
    setGreeting(computeCurrentGreeting());
  }, []);

  // Extracted to useCallback so useRealtimeSync can call it as a stable reference.
  const loadSettings = useCallback(async () => {
    if (!session) {
      setIsPublic(null);
      return;
    }
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        setIsPublic(data.is_public === true);
        setSeenOnboarding(data.seen_onboarding === true);
      } else {
        setIsPublic(false);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      setIsPublic(false);
    }
  }, [session]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // -------------------------------------------------------------------------
  // Realtime: re-fetch user settings whenever the `users` row changes
  // (e.g. is_public toggled in another tab). Falls back to 60-second polling.
  // NOTE: enable Realtime for the `users` table in Supabase and ensure the
  // anon role has a SELECT policy, or provide a user-scoped filter once a
  // Supabase JWT is available in the session.
  // -------------------------------------------------------------------------
  const { isLive: isHeaderLive } = useRealtimeSync(
    "users",
    ["UPDATE"],
    loadSettings,
  );
  useEffect(() => {
    if (!session?.githubLogin) return;

    async function evaluateCodingDistributionMilestones() {
      try {
        const res = await fetch("/api/metrics/repos?days=90");
        if (!res.ok) return;

        const data = await res.json();
        const commitsArray = data.repos || [];

        let nightOwlCommitsCount = 0;
        let earlyBirdCommitsCount = 0;

        commitsArray.forEach((repo: any) => {
          if (repo.last_commit_date) {
            const commitHour = new Date(repo.last_commit_date).getHours();
            if (commitHour >= 0 && commitHour <= 4) nightOwlCommitsCount++;
            if (commitHour >= 5 && commitHour <= 8) earlyBirdCommitsCount++;
          }
        });

        if (nightOwlCommitsCount >= 1) setIsNightOwl(true);
        if (earlyBirdCommitsCount >= 1) setIsEarlyBird(true);
      } catch (err) {
        console.error("Failed to compile milestone hour distribution profiles:", err);
      }
    }

    evaluateCodingDistributionMilestones();
  }, [session]);

  const [menuOpen, setMenuOpen] = useState(false);

  const { lastSynced } = useDashboardSync();
  const [now, setNow] = useState(() => Date.now());

  // Extract a fallback username parameter from active session data strings
  const displayName = session?.user?.name || session?.githubLogin || "Developer";
  useEffect(() => {
    if (!lastSynced) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, [lastSynced]);

  const minutesAgo = lastSynced
    ? Math.floor((now - lastSynced.getTime()) / 60000)
    : null;

  return (
    <header className="relative mb-8 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]/95 p-3 shadow-[var(--shadow-soft)] backdrop-blur-md transition-all duration-300 hover:shadow-[var(--shadow-medium)] sm:p-5 md:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[var(--accent)]/10 blur-3xl" />
      <div className="relative z-10 flex min-w-0 flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        {/* Left Section */}
        <div className="min-w-0 pr-0">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)] transition-all duration-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]"></span>
              </span>
              <span className="truncate">{greeting}, {displayName}!</span>
            </div>
            {isNightOwl && (
              <div
                title="Night Owl Milestone: You push code between Midnight and 4 AM!"
                className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-bold text-indigo-400 transition-all duration-300 hover:bg-indigo-500/20 cursor-help"
              >
                <Moon className="h-3 w-3 shrink-0 text-indigo-400" />
                <span>Night Owl</span>
              </div>
            )}
            {isEarlyBird && (
              <div
                title="Early Bird Milestone: You push code between 5 AM and 8 AM!"
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-400 transition-all duration-300 hover:bg-amber-500/20 cursor-help"
              >
                <Sun className="h-3 w-3 shrink-0 text-amber-400" />
                <span>Early Bird</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]"
              style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)" }}
            >
              Dashboard overview
            </p>
            <h1 className="mt-2 bg-gradient-to-r from-[var(--foreground)] via-[var(--foreground)] to-[var(--accent)] bg-clip-text text-xl font-extrabold text-transparent sm:text-3xl md:text-4xl">
              Dashboard
            </h1>
            <p
              className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]"
              style={{ fontFamily: "var(--font-jetbrains, ui-monospace, monospace)", letterSpacing: "0.06em" }}
            >
              coding activity at a glance
            </p>
            {minutesAgo !== null && (
              <p
                aria-live="polite"
                aria-atomic="true"
                className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"
              >
                {minutesAgo <= 0 ? "Synced just now" : `Synced ${minutesAgo} min ago`}
                {isHeaderLive && (
                  <span
                    title="Live — connected to Supabase Realtime"
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500"
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Live
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Right Section */}
        {/* Right Section */}
        <div className="w-full min-w-0 lg:w-auto">
          <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 lg:w-auto lg:justify-end lg:overflow-visible lg:pb-0">
            {isPublic === true && session?.githubLogin && (
              <ShareProfileButton githubLogin={session.githubLogin} />
            )}

            <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-muted)]/50 p-2 shadow-sm backdrop-blur-sm">
              <div className="transition-transform duration-200 hover:scale-[1.05]">
                <KeyboardShortcuts />
              </div>

              <div className="transition-transform duration-200 hover:scale-[1.05]">
                <NotificationBell />
              </div>

              <div className="transition-transform duration-200 hover:scale-[1.05]">
                <UserAvatar />
              </div>

              <div className="transition-transform duration-200 hover:rotate-12">
                <ThemeToggle />
              </div>

              <div className="transition-transform duration-200 hover:scale-[1.05]">
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile hamburger button - hidden since controls are inline on mobile via overflow-x-auto */}
        <Button
          variant="outline"
          size="icon"
          className="hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          )}
        </Button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card-muted)]/70 p-4 shadow-sm backdrop-blur-sm sm:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div className="transition-transform duration-200 hover:scale-[1.05]">
              <KeyboardShortcuts />
            </div>

            <div className="transition-transform duration-200 hover:scale-[1.05]">
              <NotificationBell />
            </div>

            <div className="transition-transform duration-200 hover:scale-[1.05]">
              <UserAvatar />
            </div>

            <div className="transition-transform duration-200 hover:rotate-12">
              <ThemeToggle />
            </div>

            <div className="transition-transform duration-200 hover:scale-[1.05]">
              <SignOutButton />
            </div>
          </div>

          {isPublic === true && session?.githubLogin && (
            <ShareProfileButton githubLogin={session.githubLogin} />
          )}
        </div>
      )}

      {/* Bottom Toggle */}
      <div className="mt-5">
        <AccountToggle />
      </div>

      {!seenOnboarding && <OnboardingTour />}
    </header>
  );
}