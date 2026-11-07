import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://devtrack.live";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
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
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
