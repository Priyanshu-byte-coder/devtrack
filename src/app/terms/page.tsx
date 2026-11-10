import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using DevTrack: GitHub sign-in, public profiles and the leaderboard, acceptable use, and the open-source licence.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "2026-11-10";

const SECTIONS: Array<{ title: string; body: ReactNode }> = [
  {
    title: "1. Using DevTrack",
    body: (
      <>
        DevTrack (&quot;we&quot;, devtrack.live) is a free, open-source
        dashboard that turns your GitHub activity into stats, streaks, a score
        and a rank. By signing in or otherwise using the site you agree to these
        terms and to our{" "}
        <Link
          href="/privacy-policy"
          className="text-[var(--accent)] hover:underline"
        >
          Privacy Policy
        </Link>
        . If you don&apos;t agree, please don&apos;t use DevTrack.
      </>
    ),
  },
  {
    title: "2. Signing in with GitHub",
    body: (
      <>
        You sign in through GitHub&apos;s own OAuth page on github.com. DevTrack
        never sees or stores your GitHub password. GitHub shows the exact
        permissions DevTrack asks for before you approve, and you can revoke
        access at any time in your GitHub settings under Applications. You are
        responsible for activity on your GitHub account.
      </>
    ),
  },
  {
    title: "3. Your public profile and the leaderboard",
    body: (
      <>
        When you sign in for the first time, DevTrack creates a public profile
        and lists you on the public leaderboard, showing your score, tier,
        level, streak and contribution totals. Totals can include private
        contributions, but private repository names and code are never shown.
        You can make your profile private and leave the leaderboard at any time
        in Settings. Separately, pages for any GitHub user can be built from
        their public GitHub data, as GitHub itself shows it.
      </>
    ),
  },
  {
    title: "4. Weekly email digest",
    body: (
      <>
        If your GitHub account shares an email address with DevTrack, you get a
        weekly email every Monday summarising your own coding activity. It is on
        by default. Unsubscribe from any digest email or turn it off in Settings
        at any time.
      </>
    ),
  },
  {
    title: "5. Acceptable use",
    body: (
      <>
        Don&apos;t use DevTrack to break the law, harass people, scrape or
        overload the service or GitHub&apos;s API, try to get around rate limits
        or security, impersonate others, or game the leaderboard with automated
        or fake activity. We may hide profiles, remove leaderboard entries or
        suspend access that breaks these rules.
      </>
    ),
  },
  {
    title: "6. Your data and content",
    body: (
      <>
        Your GitHub data stays yours. You let DevTrack process it to provide the
        service, including the public profile, leaderboard, badges and share
        cards you choose to use. You can export your data and delete your
        account from Settings.
      </>
    ),
  },
  {
    title: "7. Open source",
    body: (
      <>
        DevTrack&apos;s source code is available under the MIT licence at{" "}
        <a
          href="https://github.com/Priyanshu-byte-coder/devtrack"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:underline"
        >
          github.com/Priyanshu-byte-coder/devtrack
        </a>
        . These terms cover the hosted service at devtrack.live; the licence
        covers the code.
      </>
    ),
  },
  {
    title: "8. No warranty",
    body: (
      <>
        DevTrack is provided &quot;as is&quot;, without warranties of any kind.
        Stats, scores and ranks are estimates built from GitHub data and can be
        delayed, incomplete or wrong. The service may change or be unavailable
        at times.
      </>
    ),
  },
  {
    title: "9. Limitation of liability",
    body: (
      <>
        To the extent the law allows, DevTrack and its contributors are not
        liable for indirect or consequential losses, or for anything arising
        from your use of, or inability to use, the service.
      </>
    ),
  },
  {
    title: "10. Changes and contact",
    body: (
      <>
        We may update these terms; the date below shows the latest version, and
        continued use after a change means you accept it. Questions?{" "}
        <Link href="/contact" className="text-[var(--accent)] hover:underline">
          Contact us
        </Link>
        .
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <article className="mx-auto max-w-3xl px-4 py-12">
        <p className="font-pixel text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
          Legal
        </p>
        <h1 className="mt-2 font-pixel text-[clamp(1.8rem,5vw,2.6rem)] uppercase leading-none text-[var(--foreground)]">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Last updated <time dateTime={UPDATED}>November 10, 2026</time>
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]">
                {section.title}
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-[var(--muted-foreground)]">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
