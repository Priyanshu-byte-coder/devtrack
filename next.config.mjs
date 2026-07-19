import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: false,
  skipWaiting: true,
  fallbacks: {
    document: "/offline.html",
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.github\.com\/.*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "github-api-cache",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location.origin) return false;
        return (
          url.pathname === "/api/dashboard" ||
          url.pathname === "/api/goals" ||
          url.pathname.startsWith("/api/metrics/") ||
          url.pathname.startsWith("/api/streak/")
        );
      },
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "dashboard-api-cache",
        networkTimeoutSeconds: 5,
        cacheableResponse: {
          statuses: [200],
        },
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        return (
          url.origin === self.location.origin &&
          url.pathname === "/api/goals/sync"
        );
      },
      handler: "NetworkOnly",
      method: "POST",
      options: {
        backgroundSync: {
          name: "devtrack-goal-sync-queue",
          options: {
            maxRetentionTime: 24 * 60, // 24 hours
          },
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location.origin) return false;
        if (url.pathname.startsWith("/api/auth/")) return false;
        if (url.pathname.startsWith("/api/webhooks/")) return false;
        // Leaderboard is slow (GitHub + Supabase); let it bypass the SW so the
        // 5-second networkTimeout doesn't race against it and produce unhandled
        // "Failed to fetch" rejections when the cache is empty.
        if (url.pathname.startsWith("/api/leaderboard")) return false;
        return url.pathname.startsWith("/api/");
      },
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        cacheableResponse: {
          statuses: [200],
        },
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "font-assets-cache",
        cacheableResponse: {
          statuses: [0, 200],
        },
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location.origin) return false;
        return (
          url.pathname.startsWith("/_next/static/") ||
          /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp|json)$/.test(
            url.pathname,
          )
        );
      },
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets-cache",
        cacheableResponse: {
          statuses: [200],
        },
        expiration: {
          maxEntries: 160,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "github.githubassets.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            // OWASP recommends a minimum of 2 years (63,072,000 seconds).
            // preload submits the domain to the browser HSTS preload lists,
            // so even a first HTTP visit is intercepted before it leaves the device.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Content-Security-Policy",
            // base-uri 'none' — blocks <base> tag injection that could hijack
            //   relative URLs for scripts/links.
            // object-src 'none' — blocks legacy Flash/plugin XSS vectors.
            // upgrade-insecure-requests — instructs the browser to upgrade
            //   any http:// sub-resource requests to https:// automatically.
            // worker-src blob: — required for next-pwa service worker registration.
            // connect-src includes Supabase so authenticated API calls succeed,
            //   and Upstash Redis for the rate-limiter health checks.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://avatars.githubusercontent.com https://github.githubassets.com",
              "connect-src 'self' https://api.github.com https://groq.com https://api.groq.com https://*.supabase.co wss://*.supabase.co https://*.upstash.io",
              "frame-ancestors 'none'",
              "base-uri 'none'",
              "object-src 'none'",
              "upgrade-insecure-requests",
              "worker-src blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(withPWA(nextConfig));
