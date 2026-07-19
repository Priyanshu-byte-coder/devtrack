import StreakAtRiskBanner from "@/components/StreakAtRiskBanner";
import ThrottleBanner from "@/components/ThrottleBanner";
import CustomizableDashboard from "@/components/dashboard/CustomizableDashboard";
import MilestonePlanner from "@/components/MilestonePlanner";
import TodayFocusHero from "@/components/TodayFocusHero";
import DashboardHeader from "@/components/DashboardHeader";
import ExportButton from "@/components/ExportButton";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { decode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardSSEProvider from "@/components/DashboardSSEProvider";
import { DashboardWidgetA11yProvider } from "@/components/dashboard/DashboardWidgetA11yContext";
import RoastHypeWidget from "./RoastHypeWidget";


export default async function DashboardPage() {
  // In the production standalone Playwright build, getServerSession can fail to
  // read the test JWT cookie. Decode the cookie directly as a fallback so that
  // visual-regression tests (which set a real signed cookie) still render the
  // dashboard, while auth-bypass tests (no valid cookie) still redirect.
  const isPlaywrightBuild =
    process.env.PLAYWRIGHT_TEST === "true" ||
    process.env.NEXTAUTH_SECRET === "test-nextauth-secret-for-playwright-tests";

  let session;
  if (isPlaywrightBuild) {
    const cookieStore = await cookies();
    const raw = cookieStore.get("next-auth.session-token")?.value;
    if (raw) {
      try {
        const token = await decode({ secret: process.env.NEXTAUTH_SECRET!, token: raw });
        session = token
          ? { user: { name: String(token.name ?? "Playwright User"), email: String(token.email ?? "") } }
          : null;
      } catch {
        session = null;
      }
    } else {
      session = null;
    }
  } else {
    session = await getServerSession(authOptions);
  }
  if (!session) redirect("/");

  return (
    <DashboardSSEProvider>
      <DashboardWidgetA11yProvider>
        <main className="min-h-screen bg-[var(--background)] px-4 py-8 text-[var(--foreground)] transition-colors sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
          <DashboardHeader />

          <div className="mt-6 space-y-8">
            {/* Quick actions */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/wrapped"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition-opacity hover:opacity-90"
              >
                ✨ Year in Code
              </Link>
              <Link
                href="/friend-compare"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition-opacity hover:opacity-90"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Compare Friends
              </Link>
              <Link
                href="/dashboard/settings"
                className="secondary-button inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium"
              >
                Settings
              </Link>
              <div className="sm:ml-auto">
                <ExportButton />
              </div>
            </div>

            {/* Info Banners */}
            <div className="space-y-3">
              <ThrottleBanner />
              <StreakAtRiskBanner />
            </div>

            {/* Today Focus */}
            <section>
              <TodayFocusHero userName={session.user?.name ?? null} />
            </section>

            {/* Featured Section */}
            <section>
              <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-gradient-to-r from-violet-950/20 via-indigo-950/10 to-transparent p-8 shadow-lg hover:shadow-xl transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="space-y-3 max-w-xl flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider px-2.5 py-1 rounded bg-violet-500/10 border border-violet-500/20">
                      New Feature
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)] font-medium">
                      AI Resume Generator
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--foreground)] leading-tight">
                    Generate an ATS-Friendly CV Backed by Your Real Code
                  </h3>
                </div>
              </div>
            </section>

            {/* Roast/Hype Widget */}
            <section>
              <RoastHypeWidget
                stats={{
                  commits: 42,
                  languages: ["TypeScript", "Python"],
                  mergedPRs: 5,
                  failedGoals: 1,
                }}
              />
            </section>

            {/* All dashboard widgets (drag-and-drop customizable) */}
            <CustomizableDashboard />

            {/* Goals & Insights */}
            <section id="goals-insights" className="space-y-6 scroll-mt-24">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="h-8 w-1.5 rounded-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]"></div>
                <h2 className="text-2xl font-bold tracking-tight">Goals & Insights</h2>
              </div>
              <Link
                href="/dashboard/career-intelligence"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:scale-[1.03] transition-all whitespace-nowrap active:scale-95"
              >
                Build Resume
                <ChevronRight className="h-5 w-5" />
              </Link>
            </section>

            <section>
              <MilestonePlanner />
            </section>
          </div>
        </main>
      </DashboardWidgetA11yProvider>
    </DashboardSSEProvider>
  );
}