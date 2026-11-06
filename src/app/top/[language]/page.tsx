import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LanguageIcon } from "@/components/pixel/TopIcons";
import TopBoardView from "@/components/top/TopBoardView";
import {
  TOP_LANGUAGES,
  findTopLanguage,
  getTopDevelopers,
} from "@/lib/top-developers";

// Rendered on first request and then daily, like the search behind it. Not
// prerendered at build: a GitHub hiccup then would be cached for a day.
// A failed fetch throws instead, and errors are never cached.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ language: string }>;
}): Promise<Metadata> {
  const { language: slug } = await params;
  const language = findTopLanguage(slug);
  if (!language) return { title: "Top developers" };
  const title = `Top ${language.name} developers on GitHub`;
  const description = `The most-followed ${language.name} developers on GitHub, with their streaks, contributions and DevTrack rank. Updated daily.`;
  return {
    title,
    description,
    alternates: { canonical: `/top/${language.slug}` },
    openGraph: { title, description, url: `/top/${language.slug}` },
  };
}

export default async function TopLanguagePage({
  params,
}: {
  params: Promise<{ language: string }>;
}) {
  const { language: slug } = await params;
  const language = findTopLanguage(slug);
  if (!language) notFound();

  const developers = await getTopDevelopers(language);

  return (
    <TopBoardView
      crumb={language.name}
      path={`/top/${language.slug}`}
      title={`Top ${language.name} developers`}
      intro={
        <>
          The most-followed GitHub users who write {language.name}, refreshed
          daily. Open anyone to see their streak, contributions and where
          they&apos;d rank on DevTrack, or challenge them to a duel.
        </>
      }
      icon={<LanguageIcon slug={language.slug} scale={4} />}
      developers={developers}
      others={{
        heading: "Other languages",
        links: TOP_LANGUAGES.filter((l) => l.slug !== language.slug).map(
          (l) => ({
            href: `/top/${l.slug}`,
            label: l.name,
            icon: <LanguageIcon slug={l.slug} scale={2} />,
          })
        ),
      }}
      footer={
        <>
          Writing {language.name} yourself?{" "}
          <Link
            href="/compare"
            className="text-[var(--accent)] hover:underline"
          >
            Start a duel
          </Link>{" "}
          or{" "}
          <Link
            href="/leaderboard"
            className="text-[var(--accent)] hover:underline"
          >
            climb the DevTrack leaderboard
          </Link>
          .
        </>
      }
    />
  );
}
