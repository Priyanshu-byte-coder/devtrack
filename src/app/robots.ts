import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://devtrack.live";

/**
 * SEO-tool and data-mining crawlers. They bring no visitors, only sweep every
 * profile, and each page they miss in the CDN cache is a render billed as
 * Active CPU. Search engines and AI search assistants stay allowed.
 */
const BLOCKED_CRAWLERS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "Bytespider",
  "DataForSeoBot",
  "BLEXBot",
  "serpstatbot",
  "Barkrowler",
  "SeekportBot",
  "MegaIndex.ru",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /claim and ?vs= duels sit behind a link on every profile; crawling
        // them rendered a page per profile for nothing indexable.
        disallow: [
          "/api/",
          "/dashboard/",
          "/auth/",
          "/login-required",
          "/claim",
          "/compare?vs=",
        ],
      },
      { userAgent: BLOCKED_CRAWLERS, disallow: "/" },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
