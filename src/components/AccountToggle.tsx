"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useAccount } from "@/components/AccountContext";

interface LinkedAccount {
  githubId: string;
  githubLogin: string;
}

interface AccountOption {
  label: string;
  value: string | null;
}

function GitHubAvatar({ login, size = 20 }: { login: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://github.com/${login}.png?size=${size * 2}`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="rounded-full border border-[var(--border)] shrink-0"
      loading="lazy"
    />
  );
}

export default function AccountToggle() {
  const { selectedAccount, setSelectedAccount } = useAccount();
  const { data: session } = useSession();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [organizations, setOrganizations] = useState<
    Array<{ githubId: string; login: string }>
  >([]);

  // Load linked accounts from the new /api/accounts endpoint
  useEffect(() => {
    if (!session?.githubLogin) return;

    async function loadAccounts() {
      try {
        const response = await fetch("/api/accounts");
        if (!response.ok) {
          setLinkedAccounts([]);
          return;
        }
        const data = await response.json();
        setLinkedAccounts(
          (data.accounts ?? []).map(
            (a: { githubId: string; githubLogin: string }) => ({
              githubId: a.githubId,
              githubLogin: a.githubLogin,
            })
          )
        );
      } catch {
        setLinkedAccounts([]);
      }
    }

    loadAccounts();
  }, [session?.githubLogin]);

  // Load organization accounts
  useEffect(() => {
    if (!session?.githubLogin) return;

    async function loadOrgs() {
      try {
        const response = await fetch("/api/user/orgs");
        if (!response.ok) return;

        const data = await response.json();
        const config = data.config || {};

        const enabledOrgs: Array<{ githubId: string; login: string }> = [];
        (data.accounts || []).forEach((acc: any) => {
          (acc.orgs || []).forEach((org: any) => {
            if (config[org.login] !== false) {
              enabledOrgs.push({ githubId: acc.githubId, login: org.login });
            }
          });
        });
        setOrganizations(enabledOrgs);
      } catch (e) {
        console.error("Failed to load organizations in AccountToggle:", e);
      }
    }

    loadOrgs();
  }, [session?.githubLogin]);

  if (
    !session?.githubLogin ||
    (linkedAccounts.length === 0 && organizations.length === 0)
  ) {
    return null;
  }

  const accountOptions: AccountOption[] = [
    { label: session.githubLogin, value: null },
    ...linkedAccounts.map((a) => ({ label: a.githubLogin, value: a.githubId })),
    ...(linkedAccounts.length > 0
      ? [{ label: "Combined", value: "combined" }]
      : []),
    ...organizations.map((org) => ({
      label: org.login,
      value: `org:${org.githubId}:${org.login}`,
    })),
  ];

  return (
    <div
      className="mt-4 flex flex-wrap gap-1.5"
      role="group"
      aria-label="Select GitHub account or organization"
    >
      {accountOptions.map((option) => {
        const isActive = selectedAccount === option.value;
        const isOrgOption = option.value?.startsWith("org:") ?? false;
        const isCombined = option.value === "combined";
        const showAvatar = !isCombined && !isOrgOption;
        const avatarLogin = isCombined
          ? null
          : isOrgOption
          ? option.label
          : option.label;

        return (
          <button
            key={`${option.label}-${option.value ?? "primary"}`}
            type="button"
            aria-pressed={isActive}
            onClick={() => setSelectedAccount(option.value)}
            className={`inline-flex max-w-[10rem] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              isActive
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                : "border-[var(--card-muted)] bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
            }`}
          >
            {showAvatar && avatarLogin ? (
              <GitHubAvatar login={avatarLogin} size={18} />
            ) : isCombined ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            )}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}