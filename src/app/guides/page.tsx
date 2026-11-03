import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Guides: GitHub stats, streaks and profiles",
  description:
    "Short, practical guides: add GitHub stats to your README, keep a GitHub streak, compare two GitHub profiles, and how the DevTrack score works.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "DevTrack guides",
    description: "GitHub stats, streaks and profiles, explained.",
    url: "/guides",
  },
};

export default function GuidesIndex() {
  return (
    <div className="pb-10">
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        Strategy guide
      </p>
      <h1 className="mt-2 font-pixel text-[clamp(2rem,5vw,3.25rem)] uppercase leading-none text-[var(--foreground)]">
        Guides
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
        Practical answers about GitHub stats, streaks and profiles.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={`/guides/${guide.slug}`}
              className="pu-card flex h-full flex-col bg-[var(--card)] p-5 focus-visible:outline-none"
            >
              <span className="font-semibold text-[var(--card-foreground)]">
                {guide.title}
              </span>
              <span className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                {guide.description}
              </span>
              <span className="mt-4 font-pixel text-[10px] uppercase tracking-[0.14em] text-[var(--accent)]">
                Read ▶
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
