"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

const MONO = "var(--font-jetbrains, ui-monospace, monospace)";
const DISP = "var(--font-syne, system-ui, sans-serif)";

/** Maps NextAuth error codes → user-facing messages. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  github:
    "GitHub sign-in failed. This is usually caused by incorrect OAuth credentials or a mismatched callback URL. Check your GitHub OAuth App settings and try again.",
  OAuthCallback:
    "The OAuth callback could not be completed. Please try signing in again.",
  OAuthSignin:
    "Could not start the GitHub sign-in flow. Please try again.",
  Configuration:
    "There is a server configuration error. Please contact the site administrator.",
  AccessDenied:
    "Access was denied. You may have cancelled the GitHub authorization.",
  Verification:
    "The sign-in link has expired or has already been used.",
  RateLimit:
    "Too many login attempts. Please try again later.",
  RateLimitError:
    "Too many authentication attempts. Please wait a minute and try again.",
  Default:
    "An unexpected authentication error occurred. Please try again.",
};

function getErrorMessage(error: string): string {
  return AUTH_ERROR_MESSAGES[error] ?? AUTH_ERROR_MESSAGES.Default;
}

function AuthErrorBanner({ error }: { error: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        width: "100%",
        marginBottom: 24,
        padding: "12px 16px",
        borderRadius: 8,
        background: "var(--destructive-muted)",
        border: `1px solid var(--destructive-muted-border)`,
        textAlign: "left",
      }}
    >
      <p
        style={{
          fontFamily: MONO,
          fontSize: 12,
          fontWeight: 700,
          color: "var(--destructive)",
          margin: "0 0 4px",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        ⚠ Sign-in failed
      </p>
      <p
        style={{
          fontFamily: MONO,
          fontSize: 12,
          color: "var(--destructive)",
          margin: 0,
          lineHeight: 1.65,
          opacity: 0.85,
        }}
      >
        {getErrorMessage(error)}
      </p>
    </div>
  );
}

function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.transform = `translate3d(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%), 0)`;
      }
    };
    window.addEventListener("mousemove", fn, { passive: true });
    return () => window.removeEventListener("mousemove", fn);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed", pointerEvents: "none", zIndex: 0,
        left: 0, top: 0,
        width: 600, height: 600,
        background:
          "radial-gradient(circle, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 70%)",
        transform: "translate3d(-50%, -50%, 0)",
        willChange: "transform",
      }}
    />
  );
}

/**
 * Inner component that reads search params — must live inside a Suspense
 * boundary because useSearchParams() opts the subtree out of static rendering.
 */
function SignInContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

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

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <MouseSpotlight />
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "clamp(28px,5vw,48px) clamp(24px,5vw,40px)",
          background: "var(--card)",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "var(--shadow-medium)",
        }}
      >
        {/* Accent glow blob */}
        <div
          aria-hidden
          style={{
            pointerEvents: "none",
            position: "absolute",
            right: -48,
            top: -48,
            width: 144,
            height: 144,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--accent) 20%, transparent)",
            filter: "blur(24px)",
          }}
        />

        {/* BACK TO HOME */}
        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: MONO,
              color: "var(--muted-foreground)",
              textDecoration: "none",
              fontSize: 12,
            }}
          >
            ← Back to home
          </Link>
        </div>

        <div style={{ marginBottom: 36 }}>
          <span
            style={{
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 13,
              color: "var(--foreground)",
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "var(--accent)" }}>▲</span> DEVTRACK
          </span>
        </div>

        <h1
          style={{
            fontFamily: DISP,
            fontWeight: 800,
            fontSize: "clamp(34px,6vw,35px)",
            letterSpacing: "-0.04em",
            lineHeight: 1.25,
            color: "var(--foreground)",
            margin: "0 0 16px",
          }}
        >
          WELCOME<br />
          <span style={{ color: "var(--accent)" }}>BACK.</span>
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "var(--muted-foreground)",
            lineHeight: 1.65,
            margin: "0 0 36px",
            fontFamily: MONO,
          }}
        >
          Track streaks, PR velocity &amp; coding growth.
        </p>

        {error && <AuthErrorBanner error={error} />}

        <button
          type="button"
          onClick={async () => {
            try {
              const res = await signIn("github", { callbackUrl: "/dashboard", redirect: false });
              
              if (res?.error) {
                toast.error(getErrorMessage(res.error));
                return;
              }

              if (res?.url) {
                const url = new URL(res.url, window.location.origin);
                // NextAuth redirects to ?csrf=true or back to the signin page if environment mismatch occurs
                if (url.searchParams.get("csrf") === "true" || url.pathname === "/auth/signin") {
                  toast.error(
                    "Sign-in failed due to a security mismatch. If you're running locally, ensure you access the app via localhost (or the exact NEXTAUTH_URL) and not 127.0.0.1.",
                    { duration: 10000 }
                  );
                } else {
                  window.location.assign(res.url);
                }
              }
            } catch (err) {
              toast.error("An unexpected error occurred during sign in.");
            }
          }}
          aria-label="Sign in with GitHub"
          className="primary-button relative w-full inline-flex items-center justify-center gap-3 rounded-xl py-3 font-semibold"
        >
          Sign in with GitHub
        </button>

        <div
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: "var(--muted-foreground)",
            letterSpacing: "0.06em",
            lineHeight: 1.8,
            marginTop: 24,
          }}
        >
          MIT License · Self-hostable · Free forever
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
