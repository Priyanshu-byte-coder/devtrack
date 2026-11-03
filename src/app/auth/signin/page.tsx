"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Github } from "lucide-react";
import { toast } from "sonner";
import PixelSprite from "@/components/buddy/PixelSprite";
import PixelArt, { type PixelIconName } from "@/components/pixel/PixelArt";

/** Maps NextAuth error codes → user-facing messages. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  github:
    "GitHub sign-in failed. This is usually caused by incorrect OAuth credentials or a mismatched callback URL. Check your GitHub OAuth App settings and try again.",
  OAuthCallback:
    "The OAuth callback could not be completed. Please try signing in again.",
  OAuthSignin: "Could not start the GitHub sign-in flow. Please try again.",
  Configuration:
    "There is a server configuration error. Please contact the site administrator.",
  AccessDenied:
    "Access was denied. You may have cancelled the GitHub authorization.",
  Verification: "The sign-in link has expired or has already been used.",
  RateLimit: "Too many login attempts. Please try again later.",
  RateLimitError:
    "Too many authentication attempts. Please wait a minute and try again.",
  Default: "An unexpected authentication error occurred. Please try again.",
};

function getErrorMessage(error: string): string {
  return AUTH_ERROR_MESSAGES[error] ?? AUTH_ERROR_MESSAGES.Default;
}

/** What signing in unlocks, as arcade pickups. */
const UNLOCKS: Array<{ icon: PixelIconName; label: string }> = [
  { icon: "heart", label: "Streak" },
  { icon: "star", label: "Global rank" },
  { icon: "coin", label: "XP & levels" },
  { icon: "gem", label: "README badges" },
];

function AuthErrorBanner({ error }: { error: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-6 w-full border-2 border-[var(--destructive)] bg-[var(--destructive-muted)] px-4 py-3 text-left"
    >
      <p className="font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--destructive)]">
        Game over · sign-in failed
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--destructive)]">
        {getErrorMessage(error)}
      </p>
    </div>
  );
}

/**
 * Inner component that reads search params — must live inside a Suspense
 * boundary because useSearchParams() opts the subtree out of static rendering.
 */
function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [starting, setStarting] = useState(false);

  // Clear the ?error= param from the URL immediately after reading it so
  // that refreshing the page or navigating back doesn't show a stale error
  // from a previous sign-in attempt.
  useEffect(() => {
    if (error && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [error]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await signIn("github", {
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (res?.error) {
        toast.error(getErrorMessage(res.error));
        setStarting(false);
        return;
      }

      if (res?.url) {
        const url = new URL(res.url, window.location.origin);
        // NextAuth redirects to ?csrf=true or back to the signin page if environment mismatch occurs
        if (
          url.searchParams.get("csrf") === "true" ||
          url.pathname === "/auth/signin"
        ) {
          toast.error(
            "Sign-in failed due to a security mismatch. If you're running locally, ensure you access the app via localhost (or the exact NEXTAUTH_URL) and not 127.0.0.1.",
            { duration: 10000 }
          );
          setStarting(false);
        } else {
          window.location.assign(res.url);
        }
      }
    } catch {
      toast.error("An unexpected error occurred during sign in.");
      setStarting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-10">
      <div aria-hidden="true" className="px-grid-bg absolute inset-0" />

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-4 inline-block font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)] hover:text-[var(--accent)]"
        >
          ◀ Back to home
        </Link>

        <div className="px-frame relative bg-[var(--card)] px-6 pb-8 pt-6 text-center sm:px-9">
          <div className="flex items-center justify-between font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
            <span>
              <span className="text-[var(--accent)]">▲</span> DevTrack
            </span>
            <span>Credits: free play</span>
          </div>

          <div className="mt-8 flex justify-center">
            <span className="buddy-bob block">
              <PixelSprite frame="idle" scale={5} />
            </span>
          </div>

          <p className="mt-5 font-pixel text-[11px] uppercase tracking-[0.22em] text-[var(--accent)]">
            Player 1
          </p>
          <h1 className="mt-2 font-pixel text-[clamp(1.9rem,7vw,2.5rem)] uppercase leading-none text-[var(--card-foreground)]">
            <span className="sr-only">Sign in to DevTrack: </span>
            Press start
          </h1>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-[var(--muted-foreground)]">
            Sign in with GitHub and your player card is built from your real
            activity, ready in seconds.
          </p>

          <div className="mt-7">
            {error && <AuthErrorBanner error={error} />}
            <div className="-m-1">
              <button
                type="button"
                onClick={start}
                disabled={starting}
                aria-label="Sign in with GitHub"
                className="px-btn w-full justify-center py-3.5 text-sm disabled:cursor-wait disabled:opacity-80"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                {starting ? "Loading…" : "Continue with GitHub"}
              </button>
            </div>
            <p
              aria-hidden="true"
              className={`mt-3 font-pixel text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] ${starting ? "" : "px-blink"}`}
            >
              {starting ? "Connecting to GitHub" : "Insert coin"}
            </p>
          </div>

          <div className="mt-8 border-t-2 border-dashed border-[var(--border)] pt-5">
            <p className="font-pixel text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
              Unlocks
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-left sm:grid-cols-4 sm:text-center">
              {UNLOCKS.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2 bg-[var(--control)] px-2 py-2 sm:flex-col sm:gap-1.5"
                >
                  <PixelArt icon={item.icon} scale={2} />
                  <span className="text-[11px] leading-tight text-[var(--card-foreground)]">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-[11px] leading-5 text-[var(--muted-foreground)]">
            Free and open source (MIT). GitHub shows exactly what DevTrack can
            access before you approve. New players get a public profile and a
            spot on the leaderboard; you can hide both any time in Settings.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
