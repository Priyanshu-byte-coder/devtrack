"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAccount } from "@/components/AccountContext";
import type { InactiveRepo } from "@/types/inactive-repos";

const THRESHOLDS = [30, 60, 90] as const;
type ThresholdDays = (typeof THRESHOLDS)[number];

function formatLastActive(
  value: string,
  locale: string,
  unknownText: string
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return unknownText;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function InactiveRepositoriesCard() {
  const t = useTranslations("repositories");
  const locale = useLocale();
  const { selectedAccount } = useAccount();
  const [thresholdDays, setThresholdDays] = useState<ThresholdDays>(30);
  const [repos, setRepos] = useState<InactiveRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatVisibility = useCallback(
    (value: InactiveRepo["visibility"]): string => {
      if (value === "internal") {
        return t("inactiveRepos.visibility.internal");
      }
      if (value === "unknown") {
        return t("inactiveRepos.visibility.unknown");
      }
      if (value === "public") {
        return t("inactiveRepos.visibility.public");
      }
      if (value === "private") {
        return t("inactiveRepos.visibility.private");
      }
      return value;
    },
    [t]
  );

  const fetchInactiveRepos = useCallback(() => {
    setLoading(true);
    setError(null);

    const accountParam =
      selectedAccount !== null
        ? `&accountId=${encodeURIComponent(selectedAccount)}`
        : "";

    fetch(`/api/metrics/inactive-repos?days=${thresholdDays}${accountParam}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("API error");
        }

        return response.json();
      })
      .then((payload: { repos?: InactiveRepo[] }) => {
        setRepos(payload.repos ?? []);
      })
      .catch(() => {
        setError(t("inactiveRepos.failedToLoad"));
      })
      .finally(() => setLoading(false));
  }, [selectedAccount, thresholdDays, t]);

  useEffect(() => {
    fetchInactiveRepos();
  }, [fetchInactiveRepos]);

  return (
    <div className="px-frame bg-[var(--card)] p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
            {t("inactiveRepos.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("inactiveRepos.description")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={thresholdDays}
            onChange={(event) =>
              setThresholdDays(Number(event.target.value) as ThresholdDays)
            }
            aria-label={t("inactiveRepos.thresholdAria")}
            className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-2 py-1 text-sm text-[var(--card-foreground)]"
          >
            {THRESHOLDS.map((days) => (
              <option key={days} value={days}>
                {t("inactiveRepos.thresholdOption", { days })}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchInactiveRepos}
            disabled={loading}
            aria-label={t("inactiveRepos.refreshAria")}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-[background-color,opacity,transform] hover:bg-[var(--control)] disabled:cursor-not-allowed disabled:opacity-60 hover:opacity-90 active:scale-95"
          >
            {loading ? (
              <svg
                aria-hidden="true"
                className="animate-spin h-3 w-3 text-[var(--muted-foreground)]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : null}
            <span>{t("actions.refresh")}</span>
          </button>
        </div>
      </div>

      <div className="max-h-[320px] overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[var(--border)]">
        {loading ? (
          <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="space-y-3"
          >
            <span className="sr-only">{t("inactiveRepos.loading")}</span>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className="h-20 rounded-lg skeleton-shimmer"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-[var(--destructive)]">
            <p>{error}</p>
            <button
              type="button"
              onClick={fetchInactiveRepos}
              className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-destructive/10"
            >
              {t("actions.tryAgain")}
            </button>
          </div>
        ) : repos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card-muted)] p-4 text-sm text-[var(--muted-foreground)]">
            {t("inactiveRepos.noInactive")}
          </p>
        ) : (
          <ul className="space-y-3 stagger-children">
            {repos.map((repo) => (
              <li key={repo.name} className="animate-fade-in-up">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border border-[var(--border)] bg-[var(--control)] p-4 transition-[border-color,transform,box-shadow] duration-200 hover:border-[var(--accent)] hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--card-foreground)]">
                          {repo.name}
                        </span>
                        <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                          {formatVisibility(repo.visibility)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {t("inactiveRepos.openOnGithub")}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)] sm:text-right">
                      <span>
                        {t("inactiveRepos.lastActive", {
                          date: formatLastActive(
                            repo.lastActiveAt,
                            locale,
                            t("inactiveRepos.unknownDate")
                          ),
                        })}
                      </span>
                      <span>
                        {t("inactiveRepos.inactiveDays", {
                          days: new Intl.NumberFormat(locale).format(
                            repo.inactiveDays
                          ),
                        })}
                      </span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
