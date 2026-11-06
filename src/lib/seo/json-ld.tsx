/**
 * Structured data (schema.org JSON-LD) for search engines and AI answer engines.
 * Rendered as a data block, so it never executes and CSP `script-src` does not apply.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://devtrack.live";
export const SITE_NAME = "DevTrack";
export const REPO_URL = "https://github.com/Priyanshu-byte-coder/devtrack";

type JsonLdValue = Record<string, unknown> | Record<string, unknown>[];

/** `<` is escaped so user-controlled strings (bios, names) cannot close the tag. */
export function serializeJsonLd(data: JsonLdValue): string {
  return JSON.stringify(data).replace(/</g, "\u003c");
}

export function JsonLd({ data }: { data: JsonLdValue }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}

export function siteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      // Hints for Google's site name, so results read "DevTrack".
      alternateName: ["DevTrack Live", "devtrack.live"],
      description:
        "A free GitHub activity tracker and developer leaderboard: track your GitHub activity, keep your streak alive, and see how you rank against developers worldwide.",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/android-chrome-512x512.png`,
      sameAs: [REPO_URL],
    },
  ];
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    isAccessibleForFree: true,
    codeRepository: REPO_URL,
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function profilePageJsonLd(profile: {
  username: string;
  bio: string | null;
  memberSince: string | null;
  topLanguages: Array<{ name: string }>;
}) {
  const url = `${SITE_URL}/u/${profile.username.toLowerCase()}`;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    ...(profile.memberSince ? { dateCreated: profile.memberSince } : {}),
    mainEntity: {
      "@type": "Person",
      name: profile.username,
      alternateName: profile.username,
      identifier: profile.username,
      url,
      image: `https://avatars.githubusercontent.com/${profile.username}`,
      ...(profile.bio ? { description: profile.bio } : {}),
      sameAs: [`https://github.com/${profile.username}`],
      ...(profile.topLanguages.length
        ? { knowsAbout: profile.topLanguages.slice(0, 5).map((l) => l.name) }
        : {}),
    },
  };
}

export function leaderboardJsonLd(
  entries: Array<{ username: string; rank: number }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "DevTrack global developer leaderboard",
    url: `${SITE_URL}/leaderboard`,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry) => ({
      "@type": "ListItem",
      position: entry.rank,
      url: `${SITE_URL}/u/${entry.username.toLowerCase()}`,
      name: entry.username,
    })),
  };
}
