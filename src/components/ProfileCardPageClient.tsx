"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import ProfileCard from "@/components/ProfileCard";
import { useUserSettings } from "@/hooks/useUserSettings";

export default function ProfileCardPageClient() {
  const { data: session, status: sessionStatus } = useSession();
  const { data: settings, loading: settingsLoading, error } = useUserSettings();

  if (sessionStatus === "loading" || settingsLoading) {
    return (
      <p className="text-[var(--muted-foreground)]" role="status">
        Loading profile…
      </p>
    );
  }

  if (sessionStatus === "unauthenticated" || !session) {
    return (
      <div className="surface-card max-w-md rounded-xl p-6 text-center">
        <p className="text-[var(--muted-foreground)] mb-4">
          Sign in to view your profile card.
        </p>
        <Link
          href="/auth/signin?callbackUrl=/profile-card"
          className="primary-button inline-flex rounded-lg px-4 py-2 text-sm font-semibold"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[var(--destructive)]" role="alert">
        Failed to load profile settings.
      </p>
    );
  }

  const githubLogin = session.githubLogin ?? settings?.github_login;
  const name = session.user?.name ?? githubLogin ?? "Developer";
  const bio = settings?.bio ?? "";
  const avatarUrl =
    session.user?.image ??
    (githubLogin
      ? `https://avatars.githubusercontent.com/${githubLogin}`
      : undefined);

  return (
    <ProfileCard
      name={name}
      handle={githubLogin ?? undefined}
      bio={bio}
      avatarUrl={avatarUrl ?? undefined}
      showAddBioHint={!bio.trim()}
      socials={
        githubLogin
          ? [{ href: `https://github.com/${githubLogin}`, label: "GitHub" }]
          : []
      }
    />
  );
}
