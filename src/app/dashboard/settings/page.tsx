// @ts-nocheck
"use client";

import ThemePresetPicker from "@/components/ThemePresetPicker";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect, useSearchParams } from "next/navigation";
import { useHeatmapTheme } from "@/hooks/useHeatmapTheme";
import PrivacySettings from "@/components/PrivacySettings";
import ConfirmModal from "@/components/ConfirmModal";
import MarkdownBio from "@/components/MarkdownBio";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WebhookManager from "@/components/webhook/WebhookManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { localeMetadata, locales, type AppLocale } from "@/i18n/config";

// ── Max length for the profile bio ──────────────────────────────────────────
const BIO_MAX = 160;

interface UserSettings {
  id: string;
  github_login: string;
  bio: string;
  is_public: boolean;
  public_since?: string | null;
  show_weekly_goals?: boolean;
  public_widgets?: string[];
  leaderboard_opt_in: boolean;
  weekly_digest_opt_in: boolean;
  has_wakatime_key?: boolean;
  discord_webhook_url?: string;
  timezone?: string;
  pinned_repos?: string[];
  discord_muted_until?: string | null;
  preferred_locale?: AppLocale;
}

interface LinkedAccount {
  id: string;
  githubId: string;
  githubLogin: string;
  addedAt: string;
}

interface AccountsResponse {
  accounts: LinkedAccount[];
}

function formatAddedDate(addedAt: string): string {
  return `Added ${new Date(addedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function getStatusMessage(
  success: string | null,
  error: string | null
): { kind: "success" | "error"; message: string } | null {
  if (success === "account_linked") {
    return {
      kind: "success",
      message: "Account linked successfully",
    };
  }

  if (!error) {
    return null;
  }

  if (error === "already_linked") {
    return {
      kind: "error",
      message: "This account is already linked",
    };
  }

  if (error === "cannot_link_primary_account") {
    return {
      kind: "error",
      message: "You cannot link your primary account",
    };
  }

  if (error === "invalid_state") {
    return {
      kind: "error",
      message: "Link failed: invalid state. Please try again.",
    };
  }

  if (error === "oauth_cancelled") {
    return {
      kind: "error",
      message: "Account linking was cancelled",
    };
  }

  if (error === "rate_limited") {
    return {
      kind: "error",
      message: "GitHub API rate limit reached. Please try again in a few minutes.",
    };
  }

  if (error === "token_exchange_failed") {
    return {
      kind: "error",
      message: "GitHub authorization failed. Please try again.",
    };
  }

  if (error === "github_profile_failed") {
    return {
      kind: "error",
      message: "Could not fetch GitHub profile. Please try again.",
    };
  }

  if (error === "user_not_found") {
    return {
      kind: "error",
      message: "User not found. Please sign in again.",
    };
  }

  if (error === "insert_failed") {
    return {
      kind: "error",
      message: "Failed to save account. Please try again.",
    };
  }

  return {
    kind: "error",
    message: "Account linking failed. Please try again.",
  };
}

function SettingsPageFallback() {
  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 text-[var(--foreground)] transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h1 className="mb-4 text-3xl font-bold text-[var(--foreground)]">
            Settings
          </h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-[var(--card-muted)] rounded animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPageContent() {
  const t = useTranslations("settings");
  const common = useTranslations("common");
  const activeLocale = useLocale() as AppLocale;
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(
    null
  );
  const [wakatimeKey, setWakatimeKey] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [showBioPreview, setShowBioPreview] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [savingWakatime, setSavingWakatime] = useState(false);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [timezone, setTimezone] = useState("");
  const [savingDiscord, setSavingDiscord] = useState(false);
  const [preferredLocale, setPreferredLocale] = useState<AppLocale>(activeLocale);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordMutedUntil, setDiscordMutedUntil] = useState<string | null>(null);
  const [muteDuration, setMuteDuration] = useState<number>(1);
  const copyResetTimerRef = useRef<number | null>(null);

  // GitHub Orgs States
  const [orgAccounts, setOrgAccounts] = useState<any[]>([]);
  const [orgsConfig, setOrgsConfig] = useState<Record<string, boolean>>({});
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [publicWidgets, setPublicWidgets] = useState<string[]>(["streak", "contributions"]);
  const [savingWidgets, setSavingWidgets] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);


  // Spotlight Repos States
  const [userRepos, setUserRepos] = useState<string[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState("");

  const statusMessage = useMemo(
    () =>
      getStatusMessage(searchParams.get("success"), searchParams.get("error")),
    [searchParams]
  );

  const publicProfileUsername = session?.githubLogin ?? settings?.github_login ?? "";
  const profileUrl = useMemo(
    () =>
      publicProfileUsername
        ? `https://devtrack-silk-kappa.vercel.app/u/${publicProfileUsername}`
        : "",
    [publicProfileUsername]
  );

  const { theme, setTheme } = useHeatmapTheme();

  // Handle beforeunload to warn about unsaved changes (Browser Default)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Intercept in-app navigation
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && isDirty) {
        const href = anchor.getAttribute("href");
        // Only intercept internal links
        if (href && !href.startsWith("#") && !anchor.hasAttribute("download") && !href.startsWith("http")) {
          e.preventDefault();
          e.stopPropagation();
          setPendingPath(href);
          setShowConfirmModal(true);
        }
      }
    };

    const handlePopState = () => {
      if (isDirty) {
        // We can't easily prevent popstate without a prompt
        // but we can alert the user.
        setPendingPath("BACK");
        setShowConfirmModal(true);
        // Push state back to prevent the URL from changing immediately
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isDirty]);

  const handleConfirmLeave = () => {
    setIsDirty(false); // Clear dirty state so we can navigate
    setShowConfirmModal(false);
    if (pendingPath === "BACK") {
      window.history.back();
    } else if (pendingPath) {
      router.push(pendingPath);
    }
  };

  const handleCancelLeave = () => {
    setShowConfirmModal(false);
    setPendingPath(null);
  };

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/");
    }
  }, [status]);

  // Load settings on mount
  useEffect(() => {
    if (status !== "authenticated" || !session?.githubLogin) {
      return;
    }

    async function loadSettings() {
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          setBioDraft(data.bio ?? "");
          setDiscordWebhook(data.discord_webhook_url || "");
          setTimezone(data.timezone || "UTC");
          setDiscordMutedUntil(data.discord_muted_until ?? null);
          setWebhookUrl(data.webhook_url ?? null);
          setPublicWidgets(data.public_widgets ?? ["streak", "contributions"]);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [activeLocale, session, status]);

  const handleSaveLanguage = async (value: AppLocale) => {
    if (!settings) return;

    setPreferredLocale(value);
    setSavingLanguage(true);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred_locale: value }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setPreferredLocale(updated.preferred_locale || value);
        toast.success(t("languageSaved"));
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || t("languageSaveFailed"));
      }
    } catch {
      toast.error(t("languageSaveFailed"));
    } finally {
      setSavingLanguage(false);
    }
  };

  // Load organizations on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    async function loadOrgs() {
      try {
        setLoadingOrgs(true);
        const res = await fetch("/api/user/orgs");
        if (res.ok) {
          const data = await res.json();
          setOrgAccounts(data.accounts || []);
          setOrgsConfig(data.config || {});
        }
      } catch (err) {
        console.error("Failed to load organizations:", err);
      } finally {
        setLoadingOrgs(false);
      }
    }
    loadOrgs();
  }, [status]);

  const handleToggleOrg = async (orgLogin: string, enabled: boolean) => {
    const newConfig = { ...orgsConfig, [orgLogin]: enabled };
    setOrgsConfig(newConfig);
    try {
      const res = await fetch("/api/user/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: newConfig }),
      });
      if (res.ok) {
        toast.success(`Organization ${orgLogin} sync ${enabled ? "enabled" : "disabled"}.`);
      } else {
        toast.error("Failed to update organization sync settings.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating organization settings.");
    }
  };

  // Load active repos for spotlight pinning
  useEffect(() => {
    if (status !== "authenticated") return;
    setLoadingRepos(true);
    fetch("/api/metrics/repos?days=90")
      .then((r) => r.json())
      .then((d) => {
        const names = (d.repos ?? []).map((r: any) => r.name);
        setUserRepos(names);
      })
      .catch((err) => console.error("Failed to load user repos:", err))
      .finally(() => setLoadingRepos(false));
  }, [status]);

  const handleUpdatePinnedRepos = async (newPins: string[]) => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned_repos: newPins }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        toast.success("Spotlight repositories updated successfully!");
      } else {
        toast.error("Failed to update spotlight repositories.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating spotlight repositories.");
    } finally {
      setSaving(false);
    }
  };

  const handlePinRepo = async (repoName: string) => {
    if (!settings) return;
    const currentPins = settings.pinned_repos || [];
    if (currentPins.includes(repoName)) return;
    if (currentPins.length >= 3) {
      toast.error("Maximum 3 pinned repositories allowed!");
      return;
    }

    const updatedPins = [...currentPins, repoName];
    await handleUpdatePinnedRepos(updatedPins);
  };

  const handleUnpinRepo = async (repoName: string) => {
    if (!settings) return;
    const currentPins = settings.pinned_repos || [];
    const updatedPins = currentPins.filter((name) => name !== repoName);
    await handleUpdatePinnedRepos(updatedPins);
  };

  const handleMovePin = async (index: number, direction: "up" | "down") => {
    if (!settings) return;
    const currentPins = [...(settings.pinned_repos || [])];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentPins.length) return;

    // Swap elements
    const temp = currentPins[index];
    currentPins[index] = currentPins[targetIndex];
    currentPins[targetIndex] = temp;

    await handleUpdatePinnedRepos(currentPins);
  };

  useEffect(() => {
    if (status !== "authenticated" || !session?.githubLogin) {
      return;
    }

    async function loadLinkedAccounts() {
      setAccountsError(null);
      try {
        const res = await fetch("/api/user/github-accounts");
        if (res.status === 403) {
          setAccountsError("GitHub API rate limit reached. Please try again in a few minutes.");
          setLinkedAccounts([]);
          return;
        }
        if (!res.ok) {
          setAccountsError("Failed to load linked accounts. Please refresh the page.");
          setLinkedAccounts([]);
          return;
        }

        const data = (await res.json()) as AccountsResponse;
        setLinkedAccounts(data.accounts ?? []);
      } catch (error) {
        console.error("Failed to load linked accounts:", error);
        setAccountsError("Failed to load linked accounts. Please refresh the page.");
        setLinkedAccounts([]);
      } finally {
        setAccountsLoading(false);
      }
    }

    loadLinkedAccounts();
  }, [session, status]);

  const handleTogglePublic = async (value: boolean) => {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: value }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
      } else {
        console.error("Failed to update settings");
        toast.error("Failed to update public profile setting");
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update public profile setting");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLeaderboard = async (value: boolean) => {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderboard_opt_in: value }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
      } else {
        console.error("Failed to update leaderboard setting");
      }
    } catch (error) {
      console.error("Error updating leaderboard setting:", error);
      toast.error("Failed to update leaderboard setting");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleWeeklyDigest = async (value: boolean) => {
    if (!settings) return;

    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekly_digest_opt_in: value }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
      } else {
        console.error("Failed to update weekly digest setting");
      }
    } catch (error) {
      console.error("Error updating weekly digest setting:", error);
    } finally {
      setSaving(false);
    }
  };

  const WIDGET_OPTIONS = [
    { key: "streak", label: "Streak stats", description: "Current streak, longest streak, active days" },
    { key: "contributions", label: "Contribution graph", description: "30-day commit activity heatmap" },
    { key: "languages", label: "Top languages", description: "Language breakdown from recent repos" },
    { key: "prs", label: "Pull requests", description: "Total PRs authored" },
  ] as const;

  const handleToggleWidget = (key: string, checked: boolean) => {
    setPublicWidgets((prev) =>
      checked ? [...prev, key] : prev.filter((w) => w !== key)
    );
    setIsDirty(true);
  };

  const handleSaveWidgets = async () => {
    if (!settings) return;
    setSavingWidgets(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_widgets: publicWidgets }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setPublicWidgets(updated.public_widgets ?? ["streak", "contributions"]);
        setIsDirty(false);
        toast.success("Widget visibility saved!");
      } else {
        toast.error("Failed to save widget settings.");
      }
    } catch {
      toast.error("Failed to save widget settings.");
    } finally {
      setSavingWidgets(false);
    }
  };

  const handleSaveWakatime = async () => {
    if (!settings) return;
    setSavingWakatime(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wakatime_api_key: wakatimeKey }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setWakatimeKey("");
        setIsDirty(false);
        toast.success(wakatimeKey === "" ? "Wakatime key removed" : "Wakatime key saved successfully!");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update Wakatime key");
      }
    } catch (error) {
      console.error("Error updating Wakatime key:", error);
      toast.error("Failed to update Wakatime key");
    } finally {
      setSavingWakatime(false);
    }
  };

  const handleSaveBio = async () => {
    if (!settings || bioDraft.length > 500) return;

    setSavingBio(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioDraft }),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setBioDraft(updated.bio ?? "");
        setIsDirty(false);
        toast.success("Bio saved successfully!");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update bio");
      }
    } catch (error) {
      console.error("Error updating bio:", error);
      toast.error("Failed to update bio");
    } finally {
      setSavingBio(false);
    }
  };

  const handleSaveDiscord = async () => {
    if (!settings) return;
    setSavingDiscord(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_webhook_url: discordWebhook, timezone, discord_muted_until: discordMutedUntil }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setIsDirty(false);
        toast.success(discordWebhook === "" ? "Discord Webhook removed" : "Discord settings saved successfully!");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to update Discord settings");
      }
    } catch (error) {
      console.error("Error updating Discord settings:", error);
      toast.error("Failed to update Discord settings");
    } finally {
      setSavingDiscord(false);
    }
  };

  const handleTestDiscord = async () => {
    if (!discordWebhook) {
      toast.error("Please enter a Webhook URL first");
      return;
    }
    setTestingDiscord(true);
    try {
      const res = await fetch("/api/user/settings/discord-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: discordWebhook }),
      });
      if (res.ok) {
        toast.success("Test notification sent! Check your Discord server.");
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to send test notification");
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      toast.error("Failed to send test notification");
    } finally {
      setTestingDiscord(false);
    }
  };

  const handleMuteDiscord = async () => {
    if (!settings) return;
    const dayLabel = muteDuration === 1 ? "day" : "days";
    const mutedUntil = new Date();
    mutedUntil.setDate(mutedUntil.getDate() + muteDuration);
    setSavingDiscord(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_muted_until: mutedUntil.toISOString() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setDiscordMutedUntil(updated.discord_muted_until);
        setIsDirty(false);
        toast.success("Discord notifications muted for " + muteDuration + " " + dayLabel);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to mute notifications");
      }
    } catch (_err) {
      console.error("mute error", _err);
      toast.error("Failed to mute notifications");
    } finally {
      setSavingDiscord(false);
    }
  };

  const handleUnmuteDiscord = async () => {
    if (!settings) return;
    setSavingDiscord(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord_muted_until: null }),
      });
      const updated = await res.json();
      if (!res.ok) {
        toast.error(updated.error || "Failed to unmute notifications");
        return;
      }
      setSettings(updated);
      setDiscordMutedUntil(null);
      setIsDirty(false);
      toast.success("Discord notifications unmuted");
    } catch (_err) {
      console.error("unmute error", _err);
      toast.error("Failed to unmute notifications");
    } finally {
      setSavingDiscord(false);
    }
  };

  const copyShareLink = () => {
    if (!profileUrl) return;

    if (copyResetTimerRef.current) {
      window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }

    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard access is not available in this browser.");
      return;
    }

    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true);
      toast.success("Link copied successfully!");
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyResetTimerRef.current = null;
      }, 2000);
    }).catch((err) => {
      console.error("Clipboard copy failed:", err);
      toast.error("Failed to copy profile URL");
    });
  };

  const handleRemoveAccount = async (githubId: string) => {
    setRemoveError(null);
    setRemovingAccountId(githubId);

    try {
      const res = await fetch(`/api/user/github-accounts/${githubId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setRemoveError(data.error ?? "Failed to remove account");
        return;
      }

      setLinkedAccounts((current) =>
        current.filter((account) => account.githubId !== githubId)
      );
    } catch (error) {
      console.error("Failed to remove account:", error);
      setRemoveError("Failed to remove account");
      toast.error("Failed to remove account");
    } finally {
      setRemovingAccountId(null);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 text-[var(--foreground)] transition-colors">
        <div className="max-w-2xl mx-auto">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="h-8 w-48 bg-[var(--card-muted)] rounded animate-pulse mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 bg-[var(--card-muted)] rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 text-[var(--foreground)] transition-colors">
        <div className="max-w-2xl mx-auto">
          <p className="text-[var(--muted-foreground)]">
            Failed to load settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-8 text-[var(--foreground)] transition-colors">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <Link href="/dashboard">
            <button aria-label="Back to Dashboard" className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--accent)] md:bg-[var(--accent)] md:text-[var(--accent-foreground)] transition-all hover:opacity-90 active:scale-95 md:h-auto md:w-auto md:rounded-lg md:px-4 md:py-2">
              <span aria-hidden="true" className="text-lg items-center transition-transform duration-200 group-hover:-translate-x-1.5">
                ←
              </span>
              <span className="ml-2 hidden text-sm font-medium md:inline">
                Back to Dashboard
              </span>
            </button>
          </Link>
          <div className="sm:text-left mr-2">
            <h1 className="text-3xl pl-2 text-center font-bold text-[var(--foreground)]">
              Settings
            </h1>
            <p className="md:text-right text-center mt-2 text-[var(--muted-foreground)]">
              Manage your profile and preferences
            </p>
          </div>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm ${statusMessage.kind === "success"
              ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
              : "border-[var(--error)]/30 bg-[var(--error)]/10 text-[var(--error)]"
              }`}
          >
            {statusMessage.message}
          </div>
        )}

        {/* Public Profile Section */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex items-start justify-between mb-2 gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                Public Profile
              </h2>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                Share your GitHub stats with a public profile link
              </p>
            </div>

            {/* Toggle Switch */}
            <label className="flex items-center cursor-pointer select-none"><span className="sr-only">Toggle setting</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.is_public}
                  aria-label="Toggle Public Profile"
                  onChange={(e) => handleTogglePublic(e.target.checked)}
                  disabled={saving}
                  className="sr-only"
                />
                <div
                  className={`block w-10 h-6 rounded-full transition-colors ${settings.is_public
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--control)]"
                    }`}
                />
                <div
                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--card)] transition-transform ${settings.is_public ? "translate-x-4" : ""
                    }`}
                />
              </div>
            </label>
          </div>

          {/* Share Link Section */}
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Badge
                variant={settings.is_public ? "success" : "secondary"}
                className="px-3 py-1 text-[11px] uppercase tracking-wide"
              >
                {settings.is_public ? "Public" : "Private"}
              </Badge>
              {settings.public_since && (
                <p className="text-xs text-[var(--muted-foreground)] sm:text-right">
                  Public since {new Date(settings.public_since).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={profileUrl}
                readOnly
                aria-label="Public profile URL"
                className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] outline-none transition-colors focus:border-[var(--accent)]"
              />
              <Button
                type="button"
                onClick={copyShareLink}
                variant="secondary"
                className="w-full sm:w-auto"
                aria-label="Copy public profile URL"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            {!settings.is_public && (
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                Your profile is currently private. Enable Public Profile to allow others to view this link.
              </p>
            )}
          </div>

          {/* Weekly Goals on Profile toggle */}
          {settings.is_public && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
                    Weekly Goal Progress
                  </h3>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    Show your weekly goal completion rate on your public profile.
                  </p>
                </div>
                <label className="flex items-center cursor-pointer select-none"><span className="sr-only">Toggle weekly goal visibility</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={settings.show_weekly_goals ?? false}
                      aria-label="Toggle weekly goal progress on profile"
                      onChange={async (e) => {
                        const value = e.target.checked;
                        setSaving(true);
                        try {
                          const res = await fetch("/api/user/settings", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ show_weekly_goals: value }),
                          });
                          if (res.ok) {
                            const updated = await res.json();
                            setSettings(updated);
                          }
                        } catch (error) {
                          console.error("Failed to update weekly goals setting:", error);
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className="sr-only"
                    />
                    <div
                      className={`block w-10 h-6 rounded-full transition-colors ${settings.show_weekly_goals
                        ? "bg-[var(--accent)]"
                        : "bg-[var(--control)]"
                        }`}
                    />
                    <div
                      className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--card)] transition-transform ${settings.show_weekly_goals ? "translate-x-4" : ""
                        }`}
                    />
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ── Public Widget Selector ────────────────────────────────── */}
          {settings.is_public && (
            <div className="mt-6 pt-6 border-t border-[var(--border)]">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
                  Visible Widgets
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Choose which stats are shown on your public profile.
                </p>
              </div>
              <div className="space-y-3">
                {WIDGET_OPTIONS.map(({ key, label, description }) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-3 transition-colors hover:bg-[var(--control)]/80"
                  >
                    <input
                      type="checkbox"
                      checked={publicWidgets.includes(key)}
                      onChange={(e) => handleToggleWidget(key, e.target.checked)}
                      className="mt-0.5 accent-[var(--accent)]"
                    />
                    <div>
                      <div className="text-sm font-medium text-[var(--card-foreground)]">{label}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{description}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSaveWidgets}
                disabled={savingWidgets}
                className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {savingWidgets ? "Saving..." : "Save Widget Settings"}
              </button>
            </div>
          )}

          {/* ── Profile Bio with Markdown preview ─────────────────────── */}
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--card-foreground)]">
                  Profile Bio
                </h3>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Add a short Markdown bio for your public profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBioPreview((value) => !value)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--control)]"
              >
                {showBioPreview ? "Hide Preview" : "Show Preview"}
              </button>
            </div>

            <textarea
              value={bioDraft}
              onChange={(e) => {
                setBioDraft(e.target.value);
                setIsDirty(true);
              }}
              maxLength={500}
              rows={5}
              placeholder="Write a short bio with **bold**, _italic_, `code`, or links."
              className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-3 text-sm text-[var(--card-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--control)]">
  <div
    className={`h-full transition-all ${
      bioDraft.length >= 490
        ? "bg-red-500"
        : bioDraft.length >= 450
        ? "bg-yellow-500"
        : "bg-[var(--accent)]"
    }`}
    style={{ width: `${(bioDraft.length / 500) * 100}%` }}
  />
</div>
            {showBioPreview && (
              <div className="mt-3 min-h-[128px] rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 text-[var(--card-foreground)]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Live Preview
                </p>
                {bioDraft.trim() ? (
                  <MarkdownBio bio={bioDraft} />
                ) : (
                  <p className="text-sm text-[var(--muted-foreground)]">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span
                className={`text-xs ${bioDraft.length > 500
                  ? "text-[var(--error)]"
                  : "text-[var(--muted-foreground)]"
                  }`}
              >
                {bioDraft.length}/500 characters
              </span>
              <button
                type="button"
                onClick={handleSaveBio}
                disabled={
                  savingBio ||
                  bioDraft.length > 500 ||
                  bioDraft === (settings.bio ?? "")
                }
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {savingBio ? "Saving..." : "Save Bio"}
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-3">
              Heatmap colour scheme
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Choose a colour scheme for the contribution and streak heatmaps.
            </p>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-3 text-[var(--foreground)]">
                <span>Default</span>
                <input
                  type="radio"
                  name="heatmap-theme"
                  value="default"
                  checked={theme === "default"}
                  onChange={() => {
                    setTheme("default");
                    setIsDirty(true);
                  }}
                  className="accent-[var(--accent)] focus-visible:ring-[var(--accent)]"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-3 text-[var(--foreground)]">
                <span>Colour-blind friendly</span>
                <input
                  type="radio"
                  name="heatmap-theme"
                  value="colour-blind-friendly"
                  checked={theme === "colour-blind-friendly"}
                  onChange={() => {
                    setTheme("colour-blind-friendly");
                    setIsDirty(true);
                  }}
                  className="accent-[var(--accent)] focus-visible:ring-[var(--accent)]"
                />
              </label>
            </div>
          </div>

          {!settings.is_public && (
            <div className="mt-4 p-3 rounded-lg bg-[var(--control)] border border-[var(--border)]">
              <p className="text-sm text-[var(--muted-foreground)]">
                Turn on public profile to generate a shareable link to your
                GitHub stats.
              </p>
            </div>
          )}

          {isDirty && (
            <div className="mt-6 pt-6 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  // The toggles themselves already call the API,
                  // but for the heatmap theme which is local only,
                  // or to clear the dirty state after a manual change,
                  // we provide this clear feedback.
                  setIsDirty(false);
                  toast.success("Settings saved successfully!");
                }}
                className="px-6 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
            {t("appearanceTitle")}
          </h2>

          <p className="mt-1 text-sm text-[var(--muted-foreground)] mb-6">
            {t("appearanceDescription")}
          </p>

          <ThemePresetPicker />
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                {t("languageTitle")}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("languageDescription")}
              </p>
            </div>
            <div className="w-full md:w-64">
              <label
                htmlFor="preferred-locale"
                className="block text-sm font-medium text-[var(--card-foreground)]"
              >
                {t("languageSelectLabel")}
              </label>
              <select
                id="preferred-locale"
                value={preferredLocale}
                disabled={savingLanguage}
                onChange={(event) => handleSaveLanguage(event.target.value as AppLocale)}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:opacity-60"
              >
                {locales.map((locale) => (
                  <option key={locale} value={locale}>
                    {localeMetadata[locale].nativeLabel}
                  </option>
                ))}
              </select>
              {savingLanguage && (
                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {common("saving")}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                Public Leaderboard
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Appear on the public leaderboard for streaks, commits, and pull
                requests.
              </p>
            </div>

            <label className="flex items-center cursor-pointer select-none"><span className="sr-only">Toggle setting</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.leaderboard_opt_in}
                  aria-label="Toggle Public Leaderboard"
                  onChange={(e) => handleToggleLeaderboard(e.target.checked)}
                  disabled={saving}
                  className="sr-only"
                />
                <div
                  className={`block h-6 w-10 rounded-full transition-colors ${settings.leaderboard_opt_in
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--control)]"
                    }`}
                />
                <div
                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--card)] transition-transform ${settings.leaderboard_opt_in ? "translate-x-4" : ""
                    }`}
                />
              </div>
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--control)] p-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              Turning this on also enables your public profile so leaderboard
              rows can link to your DevTrack stats.
            </p>

          </div>
        </div>

        {/* Repository Spotlight Section */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
            Repository Spotlight 🚀
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)] mb-6">
            Pin up to 3 repositories to showcase on your dashboard and public profile.
          </p>

          {/* Currently Pinned */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-3">
              Pinned Repositories ({(settings.pinned_repos || []).length}/3)
            </h3>
            {(settings.pinned_repos || []).length === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 text-sm text-[var(--muted-foreground)] text-center">
                No repositories pinned yet. Use the search below to spotlight your best projects!
              </div>
            ) : (
              <div className="space-y-3">
                {(settings.pinned_repos || []).map((repoName, index) => (
                  <div
                    key={repoName}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)] p-4"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <span className="text-sm font-semibold text-[var(--card-foreground)] truncate block">
                        {repoName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        onClick={() => handleMovePin(index, "up")}
                        disabled={index === 0 || saving}
                        title="Move Up"
                        aria-label={`Move ${repoName} up`}
                        className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--control-hover)] text-[var(--card-foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePin(index, "down")}
                        disabled={index === (settings.pinned_repos || []).length - 1 || saving}
                        title="Move Down"
                        aria-label={`Move ${repoName} down`}
                        className="p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--control-hover)] text-[var(--card-foreground)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ↓
                      </button>

                      {/* Unpin Button */}
                      <button
                        type="button"
                        onClick={() => handleUnpinRepo(repoName)}
                        disabled={saving}
                        aria-label={`Unpin ${repoName}`}
                        className="ml-2 rounded-lg border border-[var(--destructive-muted-border)] hover:bg-[var(--destructive-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--destructive)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Unpin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pin New Repos (Search) */}
          {(settings.pinned_repos || []).length < 3 && (
            <div className="border-t border-[var(--border)]/60 pt-6">
              <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-3">
                Search & Pin Repositories
              </h3>
              <input
                type="text"
                value={repoSearchQuery}
                onChange={(e) => setRepoSearchQuery(e.target.value)}
                disabled={saving}
                placeholder="Type to search your repositories..."
                aria-label="Search repositories to pin"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
              />

              {loadingRepos ? (
                <div className="text-center py-4 text-xs text-[var(--muted-foreground)]">
                  Loading your repositories...
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
                  {userRepos
                    .filter(
                      (repoName) =>
                        !(settings.pinned_repos || []).includes(repoName) &&
                        repoName.toLowerCase().includes(repoSearchQuery.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((repoName) => (
                      <div
                        key={repoName}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)]/40 hover:bg-[var(--control)] px-4 py-2 transition-colors"
                      >
                        <span className="text-xs font-medium text-[var(--card-foreground)] truncate">
                          {repoName}
                        </span>
                        <button
                          type="button"
                          onClick={() => handlePinRepo(repoName)}
                          disabled={saving}
                          aria-label={`Pin ${repoName}`}
                          className="rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] px-3 py-1 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Pin
                        </button>
                      </div>
                    ))}
                  {userRepos.filter(
                    (repoName) =>
                      !(settings.pinned_repos || []).includes(repoName) &&
                      repoName.toLowerCase().includes(repoSearchQuery.toLowerCase())
                  ).length === 0 && (
                      <div className="text-center py-4 text-xs text-[var(--muted-foreground)]">
                        No repositories available to pin.
                      </div>
                    )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                {t("weeklyDigestTitle")}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("weeklyDigestDescription")}
              </p>
            </div>

            <label className="flex items-center cursor-pointer select-none"><span className="sr-only">Toggle setting</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.weekly_digest_opt_in}
                  aria-label="Toggle Weekly Email Digest"
                  onChange={(e) => handleToggleWeeklyDigest(e.target.checked)}
                  disabled={saving}
                  className="sr-only"
                />
                <div
                  className={`block h-6 w-10 rounded-full transition-colors ${settings.weekly_digest_opt_in
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--control)]"
                    }`}
                />
                <div
                  className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--card)] transition-transform ${settings.weekly_digest_opt_in ? "translate-x-4" : ""
                    }`}
                />
              </div>
            </label>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                {t("notificationsTitle")}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("notificationsDescription")}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm font-medium text-[var(--card-foreground)]">
              {t("webhookUrl")}
            </label>
            <input
              type="text"
              value={webhookUrl ?? ""}
              onChange={(e) => setWebhookUrl(e.target.value || null)}
              placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!settings) return;
                  setWebhookSaving(true);
                  try {
                    const res = await fetch("/api/user/settings", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ webhook_url: webhookUrl }),
                    });

                    if (res.ok) {
                      const updated = await res.json();
                      setSettings(updated);
                    } else {
                      console.error("Failed to update webhook setting");
                    }
                  } catch (err) {
                    console.error("Error updating webhook:", err);
                  } finally {
                    setWebhookSaving(false);
                  }
                }}
                disabled={webhookSaving}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {webhookSaving ? common("saving") : common("save")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setWebhookUrl(settings?.webhook_url ?? null);
                }}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)]"
              >
                {common("reset")}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                {t("connectedAccountsTitle")}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("connectedAccountsDescription")}
              </p>
            </div>

            <Link
              href="/api/auth/link-github"
              prefetch={false}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
            >
              {t("addGitHubAccount")}
            </Link>
          </div>

          {removeError && (
            <div className="mt-4 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
              {removeError}
            </div>
          )}

          {accountsError && (
            <div className="mt-4 rounded-lg border border-[var(--error)]/30 bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
              {accountsError}
            </div>
          )}

          <div className="mt-6">
            {accountsLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("loadingLinkedAccounts")}
              </div>
            ) : linkedAccounts.length === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 text-sm text-[var(--muted-foreground)]">
                {t("noLinkedAccounts")}
              </div>
            ) : (
              <div className="space-y-3">
                {linkedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[var(--card-foreground)]">
                        {account.githubLogin}
                      </div>
                      <div className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {formatAddedDate(account.addedAt)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAccount(account.githubId)}
                      aria-label={`Remove ${account.githubLogin}`}
                      disabled={removingAccountId === account.githubId}
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--error)]/10 hover:text-[var(--error)] disabled:opacity-60"
                    >
                      {removingAccountId === account.githubId
                        ? "Removing..."
                        : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                GitHub Organizations
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Choose which organizations to include or exclude from your dashboard metrics.
              </p>
            </div>
          </div>

          {loadingOrgs ? (
            <div className="space-y-3">
              <div className="h-10 bg-[var(--card-muted)] rounded animate-pulse" />
              <div className="h-10 bg-[var(--card-muted)] rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-6">
              {orgAccounts.some((acc) => !acc.hasOrgScope) && (
                <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-4">
                  <p className="text-sm text-amber-200">
                    <strong>Action Required:</strong> Organization access is not fully authorized. To display private organization contributions, please sign out and sign back in to grant organization permission (enable the &quot;read:org&quot; scope when prompted).
                  </p>
                </div>
              )}

              {orgAccounts.length === 0 ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 text-sm text-[var(--muted-foreground)] text-center">
                  No organizations found.
                </div>
              ) : (
                orgAccounts.map((acc) => (
                  <div key={acc.githubId} className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--card-foreground)] border-b border-[var(--border)] pb-2">
                      Organizations ({acc.githubLogin})
                    </h3>
                    {acc.orgs.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)] py-2">
                        No organization memberships found for this account.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {acc.orgs.map((org: any) => {
                          const isEnabled = orgsConfig[org.login] !== false; // default to true
                          return (
                            <div
                              key={org.id}
                              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--control)] p-3"
                            >
                              <div className="flex items-center gap-3">
                                <img
                                  src={org.avatarUrl}
                                  alt={org.login}
                                  className="w-8 h-8 rounded"
                                />
                                <span className="text-sm font-semibold text-[var(--card-foreground)]">
                                  {org.login}
                                </span>
                              </div>
                              <label className="flex items-center cursor-pointer select-none">
                                <span className="sr-only">Toggle {org.login}</span>
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={(e) => handleToggleOrg(org.login, e.target.checked)}
                                    className="sr-only"
                                  />
                                  <div
                                    className={`block h-6 w-10 rounded-full transition-colors ${
                                      isEnabled ? "bg-[var(--accent)]" : "bg-[var(--control)]"
                                    }`}
                                  />
                                  <div
                                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-[var(--card)] transition-transform ${
                                      isEnabled ? "translate-x-4" : ""
                                    }`}
                                  />
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                Wakatime Integration
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("wakatimeDescription")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="wakatime-key" className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                {t("apiKey")}
              </label>
              <div className="flex gap-2">
                <input
                  id="wakatime-key"
                  type="password"
                  value={wakatimeKey}
                  onChange={(e) => {
                    setWakatimeKey(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder={settings.has_wakatime_key ? "•••••••••••••••• (Configured)" : "Enter your Wakatime API key"}
                  autoComplete="new-password"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={handleSaveWakatime}
                  disabled={savingWakatime}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 min-w-[80px]"
                >
                  {savingWakatime ? common("saving") : common("save")}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                {settings.has_wakatime_key ? "Leave blank and click Save to remove your key." : "You can find your API key in your Wakatime Settings."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--card-foreground)]">
                {t("discordTitle")}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("discordDescription")}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="discord-webhook" className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                {t("webhookUrl")}
              </label>
              <div className="flex gap-2">
                <input
                  id="discord-webhook"
                  type="text"
                  value={discordWebhook}
                  onChange={(e) => {
                    setDiscordWebhook(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="timezone-select" className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                {t("timezoneLabel")}
              </label>
              <select
                id="timezone-select"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Central European Time (CET)</option>
                <option value="Asia/Kolkata">India Standard Time (IST)</option>
                <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                <option value="Australia/Sydney">Australian Eastern Time (AET)</option>
                {/* Additional common timezones */}
                <option value="America/Sao_Paulo">Brasilia Time (BRT)</option>
                <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
                <option value="Asia/Singapore">Singapore Standard Time (SGT)</option>
              </select>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleSaveDiscord}
                disabled={savingDiscord}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {savingDiscord ? common("saving") : t("saveDiscord")}
              </button>
              <button
                type="button"
                onClick={handleTestDiscord}
                disabled={testingDiscord || !discordWebhook}
                className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--control)] text-[var(--card-foreground)] text-sm font-medium hover:bg-[var(--card-muted)] transition-colors disabled:opacity-60"
              >
                {testingDiscord ? t("testing") : t("testNotification")}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              Leave Webhook URL blank and click Save to unlink Discord.
            </p>

            {discordWebhook && (
              <div className="border-t border-[var(--border)]/60 pt-4 mt-4">
                <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-3">
                  {t("muteNotifications")}
                </h3>
                {discordMutedUntil && new Date(discordMutedUntil).getTime() > Date.now() ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4">
                    <p className="text-sm text-[var(--card-foreground)] mb-3">
                      Muted until{" "}
                      <span className="font-semibold">
                        {new Intl.DateTimeFormat("en-US", {
                          dateStyle: "long",
                          timeStyle: "short",
                        }).format(new Date(discordMutedUntil))}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={handleUnmuteDiscord}
                      disabled={savingDiscord}
                      className="px-4 py-2 rounded-lg border border-[var(--destructive-muted-border)] text-[var(--destructive)] text-sm font-medium hover:bg-[var(--destructive-muted)] transition-colors disabled:opacity-60"
                    >
                      {savingDiscord ? common("saving") : t("unmuteNow")}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <select
                      value={muteDuration}
                      onChange={(e) => setMuteDuration(Number(e.target.value))}
                      className="rounded-lg border border-[var(--border)] bg-[var(--control)] px-4 py-2 text-sm text-[var(--card-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                    >
                      <option value={1}>1 day</option>
                      <option value={3}>3 days</option>
                      <option value={7}>7 days</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleMuteDiscord}
                      disabled={savingDiscord}
                      className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
                    >
                      {savingDiscord ? common("saving") : t("muteNotifications")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <PrivacySettings />
        <div className="mt-4 flex justify-center items-center pt-6">
          <Link href="/dashboard">
            <button aria-label="Back to Dashboard" className="group inline-flex items-center justify-center rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-all hover:opacity-90 active:scale-95">
              <span className="mr-2 transition-transform duration-200 group-hover:-translate-x-1.5">
                ←
              </span>
              {common("backToDashboard")}
            </button>
          </Link>
        </div>

        <WebhookManager />

        <ConfirmModal
          isOpen={showConfirmModal}
          title={t("unsavedTitle")}
          message={t("unsavedMessage")}
          confirmLabel={t("leaveAnyway")}
          cancelLabel={t("stayAndSave")}
          onConfirm={handleConfirmLeave}
          onCancel={handleCancelLeave}
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}
