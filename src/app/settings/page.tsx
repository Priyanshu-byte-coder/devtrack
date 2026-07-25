// @ts-nocheck
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LinkedAccount {
  id: string;
  githubId: string;
  githubLogin: string;
  addedAt: string;
}

interface AccountsResponse {
  accounts: LinkedAccount[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAddedDate(addedAt: string): string {
  return new Date(addedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusMessage(
  success: string | null,
  error: string | null
): { kind: "success" | "error"; message: string } | null {
  if (success === "account_linked") {
    return { kind: "success", message: "Account linked successfully." };
  }
  if (!error) return null;

  const messages: Record<string, string> = {
    already_linked: "This account is already linked.",
    cannot_link_primary_account: "You cannot link your primary account.",
    invalid_state: "Link failed: invalid state. Please try again.",
    oauth_cancelled: "Account linking was cancelled.",
    token_exchange_failed: "GitHub authorization failed. Please try again.",
    github_profile_failed: "Could not fetch GitHub profile. Please try again.",
    user_not_found: "User not found. Please sign in again.",
    insert_failed: "Failed to save account. Please try again.",
  };

  return {
    kind: "error",
    message: messages[error] ?? "Account linking failed. Please try again.",
  };
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function GitHubAvatar({
  login,
  size = 32,
}: {
  login: string;
  size?: number;
}) {
  return (
    <Image
      src={`https://github.com/${login}.png?size=${size * 2}`}
      alt={`${login} avatar`}
      width={size}
      height={size}
      className="rounded-full border border-[var(--border)]"
    />
  );
}

// ── Linked accounts card ──────────────────────────────────────────────────────

function LinkedAccountsSection() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusMessage = useMemo(
    () => getStatusMessage(searchParams.get("success"), searchParams.get("error")),
    [searchParams]
  );

  // Load linked accounts
  useEffect(() => {
    if (status !== "authenticated") return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok) {
          setError("Failed to load linked accounts. Please refresh.");
          return;
        }
        const data = (await res.json()) as AccountsResponse;
        setLinkedAccounts(data.accounts ?? []);
      } catch {
        setError("Failed to load linked accounts. Please refresh.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [status]);

  // Initiate OAuth link flow
  const handleLinkAccount = async () => {
    setLinking(true);
    try {
      const res = await fetch("/api/accounts/link", { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to start account linking.");
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast.error("Failed to start account linking.");
      setLinking(false);
    }
  };

  // Remove a linked account
  const handleRemove = async (account: LinkedAccount) => {
    setRemovingId(account.githubId);
    try {
      const res = await fetch(
        `/api/accounts/link/${encodeURIComponent(account.githubLogin)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to remove account.");
        return;
      }
      setLinkedAccounts((prev) =>
        prev.filter((a) => a.githubId !== account.githubId)
      );
      toast.success(`Removed @${account.githubLogin}`);
    } catch {
      toast.error("Failed to remove account.");
    } finally {
      setRemovingId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-[var(--card-muted)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {statusMessage && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            statusMessage.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              : "border-red-500/30 bg-red-500/10 text-red-500"
          }`}
          role="alert"
        >
          {statusMessage.message}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* Primary account */}
      {session?.githubLogin && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-muted)]/50 px-4 py-3">
          <GitHubAvatar login={session.githubLogin} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">
              @{session.githubLogin}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Primary account
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
            Active
          </span>
        </div>
      )}

      {/* Linked accounts list */}
      {linkedAccounts.length > 0 && (
        <ul className="space-y-2" aria-label="Linked GitHub accounts">
          {linkedAccounts.map((account) => (
            <li
              key={account.githubId}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card-muted)]/30 px-4 py-3"
            >
              <GitHubAvatar login={account.githubLogin} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--foreground)] truncate">
                  @{account.githubLogin}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Added {formatAddedDate(account.addedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(account)}
                disabled={removingId === account.githubId}
                aria-label={`Remove linked account @${account.githubLogin}`}
                className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                {removingId === account.githubId ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Empty state */}
      {linkedAccounts.length === 0 && !loading && (
        <p className="text-sm text-[var(--muted-foreground)]">
          No additional GitHub accounts linked yet.
        </p>
      )}

      {/* Link another account CTA */}
      <button
        type="button"
        onClick={handleLinkAccount}
        disabled={linking}
        aria-label="Link another GitHub account"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
          <path d="M9 18c-4.51 2-5-2-7-2" />
        </svg>
        {linking ? "Redirecting to GitHub…" : "Link another GitHub account"}
      </button>

      <p className="text-xs text-[var(--muted-foreground)]">
        Linked accounts allow you to view combined contribution stats and switch
        between your personal and work GitHub identities without signing out.
        Access tokens are stored encrypted (AES-256-GCM) and never exposed in
        your session.
      </p>
    </div>
  );
}

// ── Account switcher info card ────────────────────────────────────────────────

function AccountSwitcherInfo() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card-muted)]/30 p-4 text-sm text-[var(--muted-foreground)] space-y-1">
      <p className="font-semibold text-[var(--foreground)]">
        Account switcher
      </p>
      <p>
        Once you link another account, an account switcher will appear at the
        bottom of the Dashboard header. You can select any linked account or
        choose <strong>Combined</strong> to aggregate stats across all accounts.
        The switcher is fully keyboard-accessible (Tab + Enter/Space).
      </p>
    </div>
  );
}

// ── Page skeleton ─────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 text-[var(--foreground)]">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-[var(--card-muted)] rounded animate-pulse" />
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--card-muted)] rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SettingsContent() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/");
    }
  }, [status]);

  if (status === "loading") {
    return <PageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 text-[var(--foreground)] transition-colors">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <button
              type="button"
              aria-label="Back to Dashboard"
              className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--accent)] transition-all hover:opacity-90 active:scale-95 md:h-auto md:w-auto md:rounded-lg md:bg-[var(--accent)] md:px-4 md:py-2 md:text-[var(--accent-foreground)]"
            >
              <span
                aria-hidden="true"
                className="text-lg transition-transform duration-200 group-hover:-translate-x-1.5"
              >
                ←
              </span>
              <span className="ml-2 hidden text-sm font-medium md:inline">
                Back to Dashboard
              </span>
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Settings
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              Manage your GitHub accounts and profile
            </p>
          </div>
        </div>

        {/* Linked accounts section */}
        <section
          aria-labelledby="linked-accounts-heading"
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-4"
        >
          <div>
            <h2
              id="linked-accounts-heading"
              className="text-xl font-semibold text-[var(--card-foreground)]"
            >
              GitHub Accounts
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Link multiple GitHub accounts to view combined stats on your
              dashboard.
            </p>
          </div>

          <LinkedAccountsSection />
          <AccountSwitcherInfo />
        </section>

        {/* Quick link to full settings */}
        <div className="text-center">
          <Link
            href="/dashboard/settings"
            className="text-sm text-[var(--accent)] underline-offset-4 hover:underline"
          >
            Go to full settings (profile, notifications, integrations) →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}