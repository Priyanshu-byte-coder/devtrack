import Image from "next/image";
import type { GitHubAchievement } from "@/lib/github-achievements";
import { useTranslations } from "next-intl";

interface GitHubAchievementsProps {
  achievements: GitHubAchievement[];
  loading?: boolean;
  error?: string | null;
}

export default function GitHubAchievements({
  achievements,
  loading = false,
  error = null,
}: GitHubAchievementsProps) {
  const t = useTranslations("achievements");

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="mb-4 text-lg font-semibold text-[var(--card-foreground)]">
        {t("title")}
      </h2>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        >
          <span className="sr-only">{t("loading")}</span>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              aria-hidden="true"
              className="h-28 rounded-lg skeleton-shimmer"
            />
          ))}
        </div>
      ) : error && achievements.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("loadFailed")}
        </p>
      ) : achievements.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("empty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {achievements.map((achievement) => (
            <a
              key={achievement.slug}
              href={achievement.url}
              target="_blank"
              rel="noopener noreferrer"
              title={achievement.description}
              className="group rounded-lg border border-[var(--border)] bg-[var(--control)] p-3 text-center transition-colors hover:border-[var(--accent)]"
            >
              <Image
                src={achievement.imageUrl}
                alt={t("badgeAlt", { title: achievement.title })}
                width={56}
                height={56}
                className="mx-auto h-14 w-14 object-contain"
                loading="lazy"
              />
              <span className="mt-2 block text-xs font-medium text-[var(--card-foreground)]">
                {achievement.title}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
