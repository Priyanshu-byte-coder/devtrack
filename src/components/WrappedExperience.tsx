"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { WrappedStats } from "@/lib/wrapped";

const SLIDE_THEMES = [
  "from-cyan-500/20 via-slate-900 to-emerald-500/20",
  "from-amber-400/20 via-slate-900 to-cyan-500/20",
  "from-emerald-400/20 via-slate-900 to-rose-500/20",
  "from-sky-400/20 via-slate-900 to-lime-400/20",
  "from-fuchsia-400/20 via-slate-900 to-amber-300/20",
  "from-teal-400/20 via-slate-900 to-indigo-400/20",
  "from-orange-300/20 via-slate-900 to-cyan-300/20",
];

const formatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return formatter.format(value);
}

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = currentYear; year >= Math.max(2008, currentYear - 8); year -= 1) {
    years.push(year);
  }
  return years;
}

function getShareText(stats: WrappedStats) {
  const persona = stats.personality ? `I'm a ${stats.personality.icon} ${stats.personality.name}! ` : "";
  return `My ${stats.year} Year in Code: ${persona}${formatNumber(
    stats.totalCommits
  )} commits, ${stats.longestStreak}-day streak, and ${
    stats.topLanguages[0]?.name ?? "code"
  } on top.`;
}

function getOgImageUrl(stats: WrappedStats) {
  const params = new URLSearchParams({
    username: stats.username,
    year: String(stats.year),
    commits: String(stats.totalCommits),
    streak: String(stats.longestStreak),
    language: stats.topLanguages[0]?.name ?? "Code",
    repo: stats.mostContributedRepo.name,
  });

  return `/api/wrapped/og?${params.toString()}`;
}

export default function WrappedExperience() {
  const years = useMemo(buildYearOptions, []);
  const [selectedYear, setSelectedYear] = useState<number>(years[0] ?? new Date().getFullYear());
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedYear = Number(params.get("year"));
    if (!Number.isNaN(requestedYear) && years.includes(requestedYear)) {
      setSelectedYear(requestedYear);
    }
    setOrigin(window.location.origin);
  }, [years]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSlide(0);

    fetch(`/api/wrapped?year=${selectedYear}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load wrapped data");
        }
        return res.json();
      })
      .then((data: WrappedStats) => setStats(data))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("We could not build your Year in Code right now.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedYear, reloadKey]);

  const slides = useMemo(() => {
    if (!stats) return [];

    const languages =
      stats.topLanguages.length > 0
        ? stats.topLanguages
            .map((language) => `${language.name} ${language.percentage}%`)
            .join(" / ")
        : "No language data yet";

    return [
      {
        eyebrow: `${stats.year} recap`,
        title: `${formatNumber(stats.totalCommits)} commits`,
        body: `${stats.activeDays} active coding days captured by DevTrack.`,
        metric: "Total commits",
      },
      {
        eyebrow: "Consistency",
        title: `${stats.longestStreak} day streak`,
        body: "Your longest run of back-to-back coding days this year.",
        metric: "Longest streak",
      },
      {
        eyebrow: "Best month",
        title: stats.mostProductiveMonth.name,
        body: `${formatNumber(
          stats.mostProductiveMonth.commits
        )} commits landed in your busiest month.`,
        metric: "Most productive month",
      },
      {
        eyebrow: "Languages",
        title: stats.topLanguages[0]?.name ?? "No clear leader",
        body: languages,
        metric: "Top 3 languages",
      },
      {
        eyebrow: "Pull requests",
        title: `${formatNumber(stats.prsMerged)} merged`,
        body: "Merged pull requests authored by you during the selected year.",
        metric: "Total PRs merged",
      },
      {
        eyebrow: "Repository",
        title: stats.mostContributedRepo.name,
        body: `${formatNumber(
          stats.mostContributedRepo.commits
        )} sampled commits came from this repository.`,
        metric: "Most contributed repo",
      },
      {
        eyebrow: "Coding clock",
        title: stats.peakCodingHour.label,
        body:
          stats.peakCodingHour.hour === null
            ? "Commit timestamps were too sparse for a peak-hour insight."
            : `You coded at ${stats.peakCodingHour.label} most often.`,
        metric: "Peak coding time",
      },
      ...(stats.personality
        ? [
            {
              eyebrow: "Your Coding Persona",
              title: `${stats.personality.icon} ${stats.personality.name}`,
              body: `${stats.personality.description} ${stats.personality.reason}`,
              metric: "Coding Personality",
            },
          ]
        : []),
    ];
  }, [stats]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!slides.length) return;

      switch (event.key) {
        case "ArrowLeft":
          setSlide((value) => Math.max(0, value - 1));
          break;

        case "ArrowRight":
          setSlide((value) => Math.min(slides.length - 1, value + 1));
          break;

        case "Home":
          setSlide(0);
          break;

        case "End":
          setSlide(slides.length - 1);
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [slides.length]);

  const shareUrl = origin
    ? `${origin}/wrapped?year=${selectedYear}`
    : `/wrapped?year=${selectedYear}`;
  const shareText = stats ? getShareText(stats) : "My Year in Code on DevTrack";
  const twitterUrl = `https://twitter.com/intent/tweet?${new URLSearchParams({
    text: shareText,
    url: shareUrl,
  }).toString()}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams(
    { url: shareUrl }
  ).toString()}`;
  const currentSlide = slides[slide];

  return (
    <main className="wrapped-root min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              DevTrack
            </p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-5xl">
              Year in Code
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-300" htmlFor="wrapped-year">
              Year
            </label>
            <select
              id="wrapped-year"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="h-10 rounded-md border border-white/20 bg-slate-900 px-3 text-sm font-semibold text-white transition focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/30"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center rounded-md border border-white/20 px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {loading ? (
          <section
            role="status"
            aria-live="polite"
            aria-busy="true"
            className="grid flex-1 place-items-center py-16"
          >
            <div
              className="
              w-full
              max-w-4xl
              animate-pulse
              rounded-lg
              border
              border-white/10
              bg-white/5
              aspect-[4/3]
              min-h-[250px]
              max-h-[520px]
            "
            />
            <span className="sr-only">Loading your Year in Code</span>
          </section>
        ) : error ? (
          <section className="grid flex-1 place-items-center py-16">
            <div className="max-w-xl rounded-lg border border-rose-300/30 bg-rose-500/10 p-6 text-center">
              <h2 className="text-xl font-bold">Wrapped is taking a breather</h2>
              <p className="mt-2 text-sm text-rose-100">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-5 rounded-md bg-rose-100 px-4 py-2 text-sm font-bold text-rose-950"
              >
                Try again
              </button>
            </div>
          </section>
        ) : stats && currentSlide ? (
          <>
            <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
              <div
                tabIndex={0}
                role="region"
                aria-label="Year in Code slides"
                className={`relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${
                  SLIDE_THEMES[slide % SLIDE_THEMES.length]
                } p-6 shadow-2xl shadow-cyan-950/30 sm:p-10`}
                aria-live="polite"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
                  <div
                    className="h-full bg-cyan-300 transition-all duration-500"
                    style={{ width: `${((slide + 1) / slides.length) * 100}%` }}
                  />
                </div>
                <div
                  key={currentSlide.metric}
                  className="flex min-h-[450px] flex-col justify-between transition duration-500 ease-out animate-[fadeUp_0.45s_ease-out]"
                >
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.28em] text-cyan-200">
                      {currentSlide.eyebrow}
                    </p>
                    <h2
                      className={`mt-6 max-w-3xl overflow-hidden text-ellipsis break-all font-black leading-[0.95] text-white ${
                        currentSlide.metric === "Most contributed repo"
                          ? "line-clamp-3 text-3xl sm:text-4xl lg:text-5xl"
                          : "text-5xl sm:text-7xl"
                      }`}
                    >
                      {currentSlide.title}
                    </h2>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                      {currentSlide.body}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4 border-t border-white/10 pt-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Slide {slide + 1} of {slides.length}
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-100">
                        {currentSlide.metric}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSlide((value) => Math.max(0, value - 1))}
                        disabled={slide === 0}
                        className="h-11 rounded-md border border-white/20 px-4 text-sm font-bold text-white transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSlide((value) => Math.min(slides.length - 1, value + 1))
                        }
                        disabled={slide === slides.length - 1}
                        className="h-11 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                  <h2 className="text-lg font-bold">Share card</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Generated from your selected year.
                  </p>
                  <Image
                    src={getOgImageUrl(stats)}
                    alt={`${stats.year} Year in Code share card for ${stats.username}`}
                    width={1200}
                    height={630}
                    className="mt-4 aspect-[1200/630] w-full rounded-md border border-white/10 object-cover"
                    unoptimized
                  />
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <a
                      href={twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-md bg-white px-3 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
                    >
                      Share on X
                    </a>
                    <a
                      href={linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-md border border-white/20 px-3 text-sm font-bold text-white transition hover:border-cyan-300"
                    >
                      LinkedIn
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Commits" value={formatNumber(stats.totalCommits)} />
                  <MiniStat label="Active days" value={formatNumber(stats.activeDays)} />
                  <MiniStat label="Merged PRs" value={formatNumber(stats.prsMerged)} />
                  <MiniStat label="Peak hour" value={stats.peakCodingHour.label} />
                </div>

                {stats.partial && (
                  <p className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                    {stats.year} is still in progress, so this recap uses year-to-date data.
                  </p>
                )}
              </aside>
            </section>

            <nav
              aria-label="Wrapped slides"
              className="flex flex-wrap justify-center gap-2 pb-6"
            >
              {slides.map((item, index) => (
                <button
                  key={item.metric}
                  type="button"
                  onClick={() => setSlide(index)}
                  aria-current={slide === index ? "step" : undefined}
                  aria-label={`Go to slide ${index + 1}: ${item.metric}`}
                  className={`h-3 w-10 rounded-full transition ${
                    slide === index ? "bg-cyan-300" : "bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </nav>
          </>
        ) : null}
      </div>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-black text-white">{value}</p>
    </div>
  );
}
