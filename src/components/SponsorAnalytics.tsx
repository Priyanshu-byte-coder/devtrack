"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { Heart, Users, DollarSign, RefreshCw, Trophy, Info, ExternalLink } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import Image from "next/image";


interface ActiveSponsor {
  login: string;
  name: string;
  url: string | null;
  avatarUrl: string | null;
  privacyLevel: string;
  tierName: string;
  monthlyPriceInCents: number;
  createdAt: string;
}

interface SponsorsData {
  mrr: number;
  activeCount: number;
  growthTrend: number;
  sparklineData: { month: string; count: number }[];
  sponsors: ActiveSponsor[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as { month: string; count: number };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-[var(--card-foreground)]">
        {point.month}
      </p>
      <p className="mt-1 text-xs text-[var(--accent)] font-medium">
        {point.count} Sponsor{point.count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default function SponsorAnalytics() {
  const [data, setData] = useState<SponsorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubAuthInvalid, setGithubAuthInvalid] = useState(false);

  const fetchSponsors = useCallback((force = false) => {
    if (force) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setGithubAuthInvalid(false);

    const url = force ? "/api/metrics/sponsors?force=true" : "/api/metrics/sponsors";

    fetch(url)
      .then(async (r) => {
        const res = await r.json();
        if (res?.error === "token_expired") {
          setGithubAuthInvalid(true);
          return null;
        }
        if (!r.ok) throw new Error("API error");
        return res as SponsorsData;
      })
      .then((resData) => {
        if (!resData) return;
        setData(resData);
        if (force) {
          toast.success("Sponsors synchronized successfully.");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load sponsor analytics. Please try again shortly.");
      })
      .finally(() => {
        setLoading(false);
        setSyncing(false);
      });
  }, []);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  // Sponsor Tier Categorization
  const categorizedSponsors = useMemo(() => {
    if (!data?.sponsors) return { gold: [], silver: [], bronze: [] };

    const gold: ActiveSponsor[] = [];
    const silver: ActiveSponsor[] = [];
    const bronze: ActiveSponsor[] = [];

    data.sponsors.forEach((sponsor) => {
      const price = (sponsor.monthlyPriceInCents ?? 0) / 100;
      if (price >= 50) {
        gold.push(sponsor);
      } else if (price >= 20) {
        silver.push(sponsor);
      } else {
        bronze.push(sponsor);
      }
    });

    return { gold, silver, bronze };
  }, [data]);

  // Goal milestone calculation
  const goalProgress = useMemo(() => {
    if (!data) return { current: 0, next: 100, percent: 0 };
    const current = data.mrr;
    const next = Math.ceil((current + 1) / 100) * 100 || 100;
    const percent = Math.min(Math.round((current / next) * 100), 100);
    return { current, next, percent };
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm animate-pulse space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 rounded bg-[var(--card-muted)]" />
          <div className="h-8 w-24 rounded bg-[var(--card-muted)]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 rounded-lg bg-[var(--control)]" />
          <div className="h-24 rounded-lg bg-[var(--control)]" />
          <div className="h-24 rounded-lg bg-[var(--control)]" />
        </div>
        <div className="h-24 rounded-lg bg-[var(--control)]" />
        <div className="h-32 rounded-lg bg-[var(--control)]" />
      </div>
    );
  }

  if (githubAuthInvalid) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm text-center space-y-4">
        <Heart className="mx-auto h-12 w-12 text-[var(--muted-foreground)] opacity-50" />
        <h3 className="text-lg font-semibold text-[var(--card-foreground)]">GitHub Sponsor Analytics</h3>
        <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
          Your GitHub authorization has expired or was revoked. Please sign in again to re-connect your GitHub account and view your sponsor dashboard.
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm text-center space-y-4">
        <Heart className="mx-auto h-12 w-12 text-red-500/50" />
        <h3 className="text-lg font-semibold text-[var(--card-foreground)]">GitHub Sponsor Analytics</h3>
        <p className="text-sm text-red-500/80 max-w-md mx-auto">{error}</p>
        <button
          onClick={() => fetchSponsors(false)}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--card-muted)] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Sponsors Analytics
          </h2>
        </div>
        <button
          onClick={() => fetchSponsors(true)}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-1.5 text-xs font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--card-muted)] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Sponsors"}
        </button>
      </div>

      {/* Overview Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stat 1: Active Sponsors */}
        <div className="rounded-lg bg-[var(--control)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Active Sponsors</span>
            <Users className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--card-foreground)]">
              {data.activeCount}
            </span>
            {data.growthTrend !== 0 && (
              <span
                className={`text-xs font-semibold ${
                  data.growthTrend > 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {data.growthTrend > 0 ? "+" : ""}
                {data.growthTrend.toFixed(0)}% (30d)
              </span>
            )}
          </div>
        </div>

        {/* Stat 2: MRR */}
        <div className="rounded-lg bg-[var(--control)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Estimated MRR</span>
            <DollarSign className="h-4 w-4 text-[var(--accent)]" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[var(--card-foreground)]">
              ${data.mrr}
              <span className="text-xs font-normal text-[var(--muted-foreground)]">/mo</span>
            </span>
          </div>
        </div>

        {/* Stat 3: Goal progress */}
        <div className="rounded-lg bg-[var(--control)] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span>Goal: ${goalProgress.next}/mo</span>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded bg-[var(--border)]">
              <div
                className="h-full bg-yellow-500 transition-all duration-500"
                style={{ width: `${goalProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]">
              <span>{goalProgress.percent}% complete</span>
              <span>Need ${goalProgress.next - goalProgress.current} more</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sparkline chart */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-[var(--muted-foreground)] flex items-center gap-1.5">
          Sponsorship Growth Trajectory
          <span title="Active sponsor count over the last 6 months">
            <Info className="h-3 w-3" />
          </span>
        </h3>
        <div className="h-28 w-full bg-[var(--control)] rounded-lg p-3 border border-[var(--border)]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.sparklineData} margin={{ top: 5, right: 10, left: -25, bottom: -5 }}>
              <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 2, fill: "var(--accent)" }}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 1 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sponsors Wall Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-[var(--muted-foreground)]">
          Sponsors Wall
        </h3>

        {data.sponsors.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center space-y-2">
            <Heart className="mx-auto h-8 w-8 text-[var(--muted-foreground)] opacity-40" />
            <p className="text-xs text-[var(--muted-foreground)]">No active sponsors found.</p>
            <a
              href="https://github.com/sponsors"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--accent)] font-semibold hover:underline"
            >
              Set up GitHub Sponsors
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Gold Tier */}
            {categorizedSponsors.gold.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
                  {"Gold Sponsors (🏆 >= $50/mo)"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categorizedSponsors.gold.map((sponsor) => (
                    <SponsorAvatar key={sponsor.login} sponsor={sponsor} tierType="gold" />
                  ))}
                </div>
              </div>
            )}

            {/* Silver Tier */}
            {categorizedSponsors.silver.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {"Silver Sponsors (⭐ >= $20/mo)"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categorizedSponsors.silver.map((sponsor) => (
                    <SponsorAvatar key={sponsor.login} sponsor={sponsor} tierType="silver" />
                  ))}
                </div>
              </div>
            )}

            {/* Bronze Tier */}
            {categorizedSponsors.bronze.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  {"Bronze Sponsors (💖 < $20/mo)"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {categorizedSponsors.bronze.map((sponsor) => (
                    <SponsorAvatar key={sponsor.login} sponsor={sponsor} tierType="bronze" />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function SponsorAvatar({ sponsor, tierType }: { sponsor: ActiveSponsor; tierType: "gold" | "silver" | "bronze" }) {
  const borderClass = {
    gold: "border-2 border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.15)] hover:scale-110",
    silver: "border-2 border-slate-400/50 shadow-[0_0_8px_rgba(148,163,184,0.15)] hover:scale-110",
    bronze: "border-2 border-amber-700/50 shadow-[0_0_8px_rgba(180,83,9,0.15)] hover:scale-110",
  }[tierType];

  const content = sponsor.avatarUrl ? (
    <Image
      src={sponsor.avatarUrl}
      alt={sponsor.name}
      fill
      unoptimized
      className="object-cover"
    />
  ) : (
    <div className="h-full w-full flex items-center justify-center bg-[var(--border)] text-[var(--muted-foreground)] font-bold text-[10px]">
      {sponsor.name.slice(0, 2).toUpperCase()}
    </div>
  );

  const innerElement = sponsor.url ? (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative h-10 w-10 overflow-hidden rounded-full block cursor-pointer transition-transform duration-200 ${borderClass}`}
      title={`${sponsor.name} (${sponsor.tierName})`}
    >
      {content}
    </a>
  ) : (
    <div
      className={`relative h-10 w-10 overflow-hidden rounded-full block transition-transform duration-200 ${borderClass}`}
      title={`${sponsor.name} (${sponsor.tierName})`}
    >
      {content}
    </div>
  );

  return innerElement;
}
