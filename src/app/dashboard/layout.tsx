"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode } from "react";

async function hasActiveSession(fetcher: typeof window.fetch) {
  try {
    const response = await fetcher("/api/auth/session", { cache: "no-store" });
    if (!response.ok) return false;

    const session = await response.json();
    return Boolean(session?.user || session?.githubId || session?.accessToken);
  } catch {
    return false;
  }
}

function TokenRevokedBanner({ onReauthenticate }: { onReauthenticate: () => void }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 bg-red-600 px-6 py-3 text-white shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-xl">⚠️</span>
        <p className="text-sm font-medium">
          Your GitHub session has expired. Please sign out and sign back in to refresh your data.
        </p>
      </div>
      <button
        onClick={onReauthenticate}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        Re-authenticate
      </button>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      router.push("/");
    },
  });

  const [showTokenBanner, setShowTokenBanner] = useState(false);

  useEffect(() => {
    if (session?.error === "TokenRevoked") {
      setShowTokenBanner(true);
    }
  }, [session?.error]);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 429) {
        const clonedResponse = response.clone();

        try {
          const data = await clonedResponse.json();

          if (data?.error === "GITHUB_RATE_LIMITED") {
            const resetAt = data.rateLimit?.resetAt
              ? new Date(data.rateLimit.resetAt).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : null;

            toast.error("GitHub API rate limit reached", {
              description: resetAt
                ? `Data will refresh at ${resetAt}.`
                : "Please try again later.",
            });
          }
        } catch {
          // Ignore non-JSON 429 responses.
        }

        return response;
      }

      if (response.status === 401) {
        const cloned = response.clone();
        const sessionStillActive = await hasActiveSession(originalFetch);

        if (!sessionStillActive) {
          toast.error("Session expired. Please sign in again.");
          await signOut({ redirect: false });
          router.push("/auth/signin");
        }

        return cloned;
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  const handleReauthenticate = async () => {
    setShowTokenBanner(false);
    await signOut({ redirect: false });
    router.push("/auth/signin");
  };

  if (status === "loading") return null;

  return (
    <>
      {showTokenBanner && <TokenRevokedBanner onReauthenticate={handleReauthenticate} />}
      {children}
    </>
  );
}
