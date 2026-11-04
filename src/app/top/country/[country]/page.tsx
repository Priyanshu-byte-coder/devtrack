import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountryFlag } from "@/components/pixel/TopIcons";
import TopBoardView from "@/components/top/TopBoardView";
import {
  TOP_COUNTRIES,
  findTopCountry,
  getTopDevelopers,
} from "@/lib/top-developers";

// Same caching story as the language pages: first request, then daily.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country: slug } = await params;
  const country = findTopCountry(slug);
  if (!country) return { title: "Top developers" };
  const path = `/top/country/${country.slug}`;
  const title = `Top GitHub developers in ${country.name}`;
  const description = `The most-followed developers on GitHub in ${country.name}, with their streaks, contributions and DevTrack rank. Updated daily.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path },
  };
}

export default async function TopCountryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country: slug } = await params;
  const country = findTopCountry(slug);
  if (!country) notFound();

  const developers = await getTopDevelopers(country);
  const shortName = country.name.replace(/^the /, "");

  return (
    <TopBoardView
      crumb={shortName}
      path={`/top/country/${country.slug}`}
      title={`Top developers in ${country.name}`}
      intro={
        <>
          The most-followed GitHub users who list {country.name} as their
          location, refreshed daily. Open anyone to see their streak,
          contributions and where they&apos;d rank on DevTrack, or challenge
          them to a duel.
        </>
      }
      icon={<CountryFlag slug={country.slug} scale={4} />}
      developers={developers}
      others={{
        heading: "Other countries",
        links: TOP_COUNTRIES.filter((c) => c.slug !== country.slug).map(
          (c) => ({
            href: `/top/country/${c.slug}`,
            label: c.name.replace(/^the /, ""),
            icon: <CountryFlag slug={c.slug} scale={1} />,
          })
        ),
      }}
      footer={
        <>
          Based in {country.name}?{" "}
          <Link href="/claim" className="text-[var(--accent)] hover:underline">
            Claim your profile
          </Link>{" "}
          and see where you rank on the{" "}
          <Link
            href="/leaderboard"
            className="text-[var(--accent)] hover:underline"
          >
            DevTrack leaderboard
          </Link>
          . Lists only include people who set a location on GitHub.
        </>
      }
    />
  );
}
