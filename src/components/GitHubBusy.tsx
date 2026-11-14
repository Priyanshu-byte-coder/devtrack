import Link from "@/components/Link";

/** Shown when GitHub is rate-limiting us; the next try usually works. */
export default function GitHubBusy({
  retryHref,
  what = "these stats",
}: {
  retryHref: string;
  what?: string;
}) {
  return (
    // data-github-busy tells the page cache to keep this only briefly.
    <div
      data-github-busy=""
      className="mx-auto max-w-xl px-4 py-16 text-center"
    >
      <p className="font-pixel text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
        Loading…
      </p>
      <h1 className="mt-3 font-pixel text-3xl uppercase text-[var(--foreground)]">
        GitHub needs a breather
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
        We hit GitHub&apos;s rate limit while loading {what}. It resets within a
        minute or two. Please try again shortly.
      </p>
      <div className="-m-1 mt-8 flex flex-wrap justify-center gap-2">
        <Link href={retryHref} prefetch={false} className="px-btn">
          Try again
        </Link>
        <Link href="/leaderboard" className="px-btn px-btn-ghost">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
