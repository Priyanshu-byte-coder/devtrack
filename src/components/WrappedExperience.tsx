"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
import type { WrappedStats } from "@/lib/wrapped";
import PixelSprite from "@/components/buddy/PixelSprite";
import PixelArt, { type PixelIconName } from "@/components/pixel/PixelArt";
import PixelLoader from "@/components/buddy/PixelLoader";

/** One colour per level, from the HUD palette. */
const LEVEL_COLORS = [
  "#6ba8ff",
  "#fb923c",
  "#f2c14e",
  "#22d3ee",
  "#c77dff",
  "#34d399",
  "#f472b6",
  "#a3e635",
];

const formatter = new Intl.NumberFormat("en-US");

function formatNumber(value: number) {
  return formatter.format(value);
}

function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (
    let year = currentYear;
    year >= Math.max(2008, currentYear - 8);
    year -= 1
  ) {
    years.push(year);
  }
  return years;
}

function getShareText(stats: WrappedStats) {
  const persona = stats.personality
    ? `I'm a ${stats.personality.icon} ${stats.personality.name}! `
    : "";
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
    prs: String(stats.prsMerged),
    days: String(stats.activeDays),
    language: stats.topLanguages[0]?.name ?? "Code",
    repo: stats.mostContributedRepo.name,
  });

  return `/api/wrapped/og?${params.toString()}`;
}

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  metric: string;
  /** Pixel pickup shown on the slide; the persona slide shows Bit instead. */
  icon?: PixelIconName;
}

export default function WrappedExperience() {
  const years = useMemo(buildYearOptions, []);
  const [selectedYear, setSelectedYear] = useState<number>(
    years[0] ?? new Date().getFullYear()
  );
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
      .then((data: WrappedStats) => {
        if (
          !data ||
          !Array.isArray(data.topLanguages) ||
          !data.mostContributedRepo
        ) {
          throw new Error("Unexpected wrapped payload");
        }
        setStats(data);
      })
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

  const slides = useMemo<Slide[]>(() => {
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
        icon: "coin",
      },
      {
        eyebrow: "Consistency",
        title: `${stats.longestStreak} day streak`,
        body: "Your longest run of back-to-back coding days this year.",
        metric: "Longest streak",
        icon: "heart",
      },
      {
        eyebrow: "Best month",
        title: stats.mostProductiveMonth.name,
        body: `${formatNumber(
          stats.mostProductiveMonth.commits
        )} commits landed in your busiest month.`,
        metric: "Most productive month",
        icon: "star",
      },
      {
        eyebrow: "Languages",
        title: stats.topLanguages[0]?.name ?? "No clear leader",
        body: languages,
        metric: "Top 3 languages",
        icon: "gem",
      },
      {
        eyebrow: "Pull requests",
        title: `${formatNumber(stats.prsMerged)} merged`,
        body: "Merged pull requests authored by you during the selected year.",
        metric: "Total PRs merged",
        icon: "gem",
      },
      {
        eyebrow: "Repository",
        title: stats.mostContributedRepo.name,
        body: `${formatNumber(
          stats.mostContributedRepo.commits
        )} sampled commits came from this repository.`,
        metric: "Most contributed repo",
        icon: "star",
      },
      {
        eyebrow: "Coding clock",
        title: stats.peakCodingHour.label,
        body:
          stats.peakCodingHour.hour === null
            ? "Commit timestamps were too sparse for a peak-hour insight."
            : `You coded at ${stats.peakCodingHour.label} most often.`,
        metric: "Peak coding time",
        icon: "coin",
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
  const levelColor = LEVEL_COLORS[slide % LEVEL_COLORS.length];
  const isLast = slide === slides.length - 1;

  return (
    <div className="wrapped-root wrapped-screen relative overflow-hidden text-slate-50">
      <div aria-hidden="true" className="px-scanlines absolute inset-0" />
      <div className="relative flex min-h-[calc(100dvh-7.5rem)] w-full flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b-2 border-dashed border-white/15 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-pixel text-[10px] uppercase tracking-[0.24em] text-[#f2c14e]">
              <span className="text-[#6ba8ff]">▲</span> DevTrack presents
            </p>
            <h1 className="mt-2 font-pixel text-2xl uppercase leading-none tracking-[0.04em] sm:text-3xl">
              Year in Code
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="font-pixel text-[10px] uppercase tracking-[0.16em] text-slate-400"
              htmlFor="wrapped-year"
            >
              Select year
            </label>
            <select
              id="wrapped-year"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="h-9 border-2 border-white/25 bg-[#0b1024] px-3 font-pixel text-sm text-white transition focus-visible:border-[#6ba8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6ba8ff]/30"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </header>

        {loading ? (
          <section className="grid flex-1 place-items-center py-10">
            <PixelLoader label="Building your year" />
          </section>
        ) : error ? (
          <section className="grid flex-1 place-items-center py-16">
            <div className="max-w-xl border-2 border-rose-400/50 bg-rose-500/10 p-6 text-center">
              <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-rose-300">
                Game over
              </p>
              <h2 className="mt-2 font-pixel text-xl uppercase">
                Wrapped is taking a breather
              </h2>
              <p className="mt-3 text-sm text-rose-100">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-5 border-2 border-rose-200 bg-rose-100 px-4 py-2 font-pixel text-xs uppercase tracking-[0.12em] text-rose-950 hover:bg-white"
              >
                ▶ Continue
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
                className="wrapped-level relative min-h-[520px] overflow-hidden border-2 p-6 sm:p-10"
                style={{ "--level-c": levelColor } as CSSProperties}
                aria-live="polite"
              >
                {/* Segmented progress: one block per level. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 flex gap-1 p-1"
                >
                  {slides.map((item, index) => (
                    <span
                      key={item.metric}
                      className="h-1.5 flex-1"
                      style={{
                        background:
                          index <= slide
                            ? levelColor
                            : "rgba(255,255,255,0.12)",
                      }}
                    />
                  ))}
                </div>
                <div
                  key={currentSlide.metric}
                  className="wrapped-wipe flex min-h-[450px] flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <p
                        className="font-pixel text-xs uppercase tracking-[0.2em]"
                        style={{ color: levelColor }}
                      >
                        Level {String(slide + 1).padStart(2, "0")} ·{" "}
                        {currentSlide.eyebrow}
                      </p>
                      <span
                        aria-hidden="true"
                        className="wrapped-pickup shrink-0"
                      >
                        {currentSlide.icon ? (
                          <PixelArt icon={currentSlide.icon} scale={5} />
                        ) : (
                          <PixelSprite frame="jump" scale={4} />
                        )}
                      </span>
                    </div>
                    <h2
                      className={`mt-6 max-w-3xl font-pixel uppercase leading-[1.02] text-white ${
                        currentSlide.metric === "Most contributed repo"
                          ? "line-clamp-3 overflow-hidden text-ellipsis break-all text-2xl sm:text-3xl lg:text-4xl"
                          : "break-words text-3xl sm:text-5xl lg:text-6xl"
                      }`}
                    >
                      {currentSlide.title}
                    </h2>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                      {currentSlide.body}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-dashed border-white/15 pt-6">
                    <div>
                      <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-slate-400">
                        Slide {slide + 1} of {slides.length}
                      </p>
                      <p className="mt-2 text-xl font-bold text-slate-100">
                        {currentSlide.metric}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSlide((value) => Math.max(0, value - 1))
                        }
                        disabled={slide === 0}
                        className="h-11 border-2 border-white/25 px-4 font-pixel text-xs uppercase tracking-[0.12em] text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ◀ Previous
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSlide((value) =>
                            Math.min(slides.length - 1, value + 1)
                          )
                        }
                        disabled={isLast}
                        className="h-11 border-2 px-4 font-pixel text-xs uppercase tracking-[0.12em] text-[#05070f] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          background: levelColor,
                          borderColor: levelColor,
                        }}
                      >
                        Next ▶
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="border-2 border-white/15 bg-white/[0.04] p-5">
                  <p className="font-pixel text-[10px] uppercase tracking-[0.2em] text-[#f2c14e]">
                    {isLast ? "★ Stage clear" : "Your reward"}
                  </p>
                  <h2 className="mt-1 font-pixel text-base uppercase">
                    Share card
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Generated from your selected year.
                  </p>
                  <Image
                    src={getOgImageUrl(stats)}
                    alt={`${stats.year} Year in Code share card for ${stats.username}`}
                    width={1200}
                    height={630}
                    className="mt-4 aspect-[1200/630] w-full border-2 border-white/15 object-cover"
                    unoptimized
                  />
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <a
                      href={twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center border-2 border-white bg-white px-3 font-pixel text-xs uppercase tracking-[0.1em] text-slate-950 transition hover:bg-[#f2c14e] hover:border-[#f2c14e]"
                    >
                      Share on X
                    </a>
                    <a
                      href={linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center border-2 border-white/25 px-3 font-pixel text-xs uppercase tracking-[0.1em] text-white transition hover:border-white"
                    >
                      LinkedIn
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Commits"
                    value={formatNumber(stats.totalCommits)}
                    color="#f2c14e"
                  />
                  <MiniStat
                    label="Active days"
                    value={formatNumber(stats.activeDays)}
                    color="#34d399"
                  />
                  <MiniStat
                    label="Merged PRs"
                    value={formatNumber(stats.prsMerged)}
                    color="#c77dff"
                  />
                  <MiniStat
                    label="Peak hour"
                    value={stats.peakCodingHour.label}
                    color="#22d3ee"
                  />
                </div>

                {stats.partial && (
                  <p className="border-2 border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-100">
                    {stats.year} is still in progress, so this recap uses
                    year-to-date data.
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
                  className={`h-3 w-8 transition ${
                    slide === index ? "" : "bg-white/20 hover:bg-white/40"
                  }`}
                  style={
                    slide === index
                      ? {
                          background: LEVEL_COLORS[index % LEVEL_COLORS.length],
                        }
                      : undefined
                  }
                />
              ))}
            </nav>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="relative border-2 border-white/15 bg-white/[0.04] p-4">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: color }}
      />
      <p className="font-pixel text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words font-pixel text-xl text-white">{value}</p>
    </div>
  );
}
