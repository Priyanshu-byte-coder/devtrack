import withPWAInit from "@ducanh2912/next-pwa";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: false,
  fallbacks: {
    document: "/offline.html",
  },
  customWorkerSrc: "src/service-worker",
  publicExcludes: ["!noprecache/**/*", "!assets/**/*", "!openapi.yaml"],
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  workboxOptions: {
    skipWaiting: true,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
      {
        urlPattern: ({ request }) => request.mode === "navigate",
        handler: "NetworkOnly",
        options: {}, // The plugin attaches the public fallback only to routes with options.
      },
      {
        urlPattern: ({ url }) =>
          url.origin === self.location.origin &&
          url.pathname.startsWith("/_next/static/"),
        handler: "CacheFirst",
        options: {
          cacheName: "devtrack-static-v2",
          expiration: { maxEntries: 160, maxAgeSeconds: 86400 },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\//,
        handler: "CacheFirst",
        options: {
          cacheName: "devtrack-fonts-v2",
          expiration: { maxEntries: 16, maxAgeSeconds: 86400 },
        },
      },
    ],
  },
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
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Signed-in tools moved under /dashboard so they share the app shell.
  // Query strings are carried over automatically.
  async redirects() {
    return [
      { source: "/settings", destination: "/dashboard/settings", permanent: true },
      { source: "/friend-compare", destination: "/dashboard/friends", permanent: true },
      { source: "/rooms", destination: "/dashboard/rooms", permanent: true },
      { source: "/rooms/:roomId", destination: "/dashboard/rooms/:roomId", permanent: true },
      { source: "/project-tutor", destination: "/dashboard/project-tutor", permanent: true },
      { source: "/profile-card", destination: "/dashboard/settings", permanent: true },
    ];
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
        ],
      },
    ];
  },
};

export default withNextIntl(withPWA(nextConfig));
