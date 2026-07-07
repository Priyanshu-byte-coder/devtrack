'use client';

import { useEffect, useRef, useState } from 'react';
import Image from "next/image";
import Link from 'next/link';
import { Activity, GitPullRequest, Goal, Share2, Flame, FolderGit2, LogIn, LayoutDashboard, Target, Brain, Trophy, Users, Server, type LucideIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   PUBLIC TYPES
   ═══════════════════════════════════════════════════════════ */
export type RepoStats = {
  stars: number;
  forks: number;
  openIssues: number;
  contributorCount: number;
  goodFirstIssues: number;
  contributors: Array<{ login: string; avatar_url: string; html_url: string }>;
  totalCommits: number;
  mergedPRs: number;
};

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */
const A = 'var(--accent)';
const BG = 'transparent';
const SURF = 'var(--card)';
const BORDER = 'var(--border)';
const TEXT = 'var(--foreground)';
const MUTED = 'var(--muted-foreground)';
const HC = ['transparent', 'color-mix(in srgb, var(--accent) 25%, transparent)', 'color-mix(in srgb, var(--accent) 50%, transparent)', 'color-mix(in srgb, var(--accent) 75%, transparent)', 'var(--accent)'];
const MC = ['transparent', 'color-mix(in srgb, var(--accent) 40%, transparent)', 'color-mix(in srgb, var(--accent) 75%, transparent)', 'var(--accent)'];

const MONO = 'var(--font-jetbrains, ui-monospace, monospace)';
const DISP = 'var(--font-syne, system-ui, sans-serif)';

/* ═══════════════════════════════════════════════════════════
   PRE-SEEDED DATA  (deterministic → no hydration mismatch)
   ═══════════════════════════════════════════════════════════ */
function heatLvl(i: number): 0 | 1 | 2 | 3 | 4 {
  const d = i % 7;
  const w = Math.floor(i / 7);
  if (d === 0 || d === 6) return w % 4 === 0 ? 1 : 0;
  const h = (w * 7 + d * 13 + 17) % 20;
  if (h > 16) return 4;
  if (h > 12) return 3;
  if (h > 7) return 2;
  if (h > 3) return 1;
  return 0;
}

const HEAT = Array.from({ length: 364 }, (_, i) => heatLvl(i));
const MINI = Array.from({ length: 63 }, (_, i) => ((i * 7 + 11) % 4) as 0 | 1 | 2 | 3);
const BARS = [4, 7, 6, 8, 5, 2, 1, 6, 9, 7, 5, 8, 3, 2, 7, 8, 9, 6, 4, 1, 3];

const COMMITS = [
  'feat(streak): add 7-day rolling average',
  'fix(auth): handle token refresh edge case',
  'chore(deps): bump next to 15.3.0',
  'feat(heatmap): add tooltip on cell hover',
  'refactor(api): extract contribution parser',
  'style: align PR metrics grid spacing',
  'feat(goals): auto-progress from GitHub activity',
  'fix: timezone-aware streak calculation',
  'docs: update README with setup guide',
  'feat(leaderboard): weekly ranking system',
];

const ABOUT_HIGHLIGHTS: Array<{
  icon: LucideIcon;
  title: string;
  desc: string;
}> = [
  {
    icon: Activity,
    title: 'Live GitHub Signals',
    desc: 'Turn commits, streaks, reviews, and repository activity into a focused dashboard that updates around real developer work.',
  },
  {
    icon: GitPullRequest,
    title: 'PR Momentum',
    desc: 'Understand merge rate, review velocity, and open work so teams can spot bottlenecks before they slow shipping down.',
  },
  {
    icon: Goal,
    title: 'Goal Tracking',
    desc: 'Set weekly coding targets and see progress move automatically as GitHub activity lands across your repositories.',
  },
  {
    icon: Share2,
    title: 'Shareable Profile',
    desc: 'Create a public snapshot of your coding consistency for contributors, collaborators, and portfolio visitors.',
  },
];

/* ═══════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════ */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [vis, setVis] = useState(prefersReducedMotion);
  useEffect(() => {
    if (prefersReducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setVis(true); io.unobserve(el); }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, prefersReducedMotion]);
  return [ref, vis] as const;
}

function Counter({ end, active }: { end: number; active: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setVal(end);
      return;
    }

    const dur = 1500;
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setVal(Math.round((1 - (1 - p) ** 3) * end));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, end]);
  return <>{val.toLocaleString()}</>;
}

/* ═══════════════════════════════════════════════════════════
   3D TILT HOOK
   ═══════════════════════════════════════════════════════════ */
function use3DTilt(aggressiveness = 15) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -aggressiveness;
      const rotateY = ((x - centerX) / centerX) * aggressiveness;

      el.style.setProperty('--mouse-x', `${x}px`);
      el.style.setProperty('--mouse-y', `${y}px`);

      setStyle({
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
        transition: 'transform 0.1s ease-out'
      });
    };

    const handleMouseLeave = () => {
      setStyle({
        transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
        transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)'
      });
    };

    el.addEventListener('mousemove', handleMouseMove, { passive: true });
    el.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [aggressiveness]);

  return [ref, style] as const;
}

/* ═══════════════════════════════════════════════════════════
   MOUSE SPOTLIGHT
   ═══════════════════════════════════════════════════════════ */
function MouseSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current) {
        ref.current.style.left = e.clientX + 'px';
        ref.current.style.top = e.clientY + 'px';
      }
    };
    window.addEventListener('mousemove', fn, { passive: true });
    return () => window.removeEventListener('mousemove', fn);
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="mouse-spotlight"
      style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 0,
        width: 700, height: 700,
        background: 'radial-gradient(circle, rgba(129,140,248,0.18) 0%, rgba(129,140,248,0.06) 50%, transparent 70%)',
        transform: 'translate(-50%,-50%)',
        transition: 'left 0.15s ease-out, top 0.15s ease-out',
      }}
    />
  );
}


/* ═══════════════════════════════════════════════════════════
   BENTO WIDGETS
   ═══════════════════════════════════════════════════════════ */
const wLabel: React.CSSProperties = {
  fontFamily: MONO, fontSize: 10, fontWeight: 500,
  color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em',
};
const wValue: React.CSSProperties = {
  fontFamily: MONO, fontWeight: 600, color: TEXT,
};

function Cell({
  children, spanCols = 1, style,
}: {
  children: React.ReactNode; spanCols?: number; style?: React.CSSProperties
}) {
  const [tiltRef, tiltStyle] = use3DTilt(10);

  return (
    <div
      ref={(el) => {
        // @ts-ignore
        tiltRef.current = el;
      }}
      className="lnd-cell group relative overflow-hidden transition-all duration-300 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/20"
      style={{ 
        gridColumn: spanCols > 1 ? `span ${spanCols}` : undefined, 
        transformStyle: 'preserve-3d',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        ...tiltStyle,
        ...style 
      }}
    >
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(129,140,248,0.12) 0%, transparent 70%)',
          mixBlendMode: 'screen',
          transform: 'translateZ(1px)',
        }}
      />
      <div style={{ transform: 'translateZ(40px)', transition: 'transform 0.3s ease-out', display: 'flex', flexDirection: 'column', flex: 1, width: '100%', height: '100%', animation: 'zFloat 4s ease-in-out infinite alternate' }}>
        {children}
      </div>
    </div>
  );
}


function ChartWidget() {
  const [ref, vis] = useScrollReveal(0);
  const [hovBar, setHovBar] = useState(-1);
  const max = 9;
  return (
    <Cell spanCols={2} style={{ display: 'flex', flexDirection: 'column', minHeight: 100 }}>
      <div ref={ref} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={wLabel}>contributions / 30d</span>
        <span style={{ ...wLabel, color: A }}>■ active</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 2, minHeight: 60 }}>
        {BARS.map((v, i) => (
          <div
            key={i}
            onMouseEnter={() => setHovBar(i)}
            onMouseLeave={() => setHovBar(-1)}
            role="presentation"
            style={{
              flex: 1, borderRadius: '2px 2px 0 0',
              background: hovBar === i ? '#fff' : A,
              height: vis ? `${(v / max) * 100}%` : '0%',
              opacity: hovBar === i ? 1 : 0.3 + (v / max) * 0.7,
              transition: `height 0.5s cubic-bezier(0.4,0,0.2,1) ${i * 20}ms, opacity 0.15s`,
              cursor: 'crosshair', position: 'relative',
            }}
          >
            {hovBar === i && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%',
                transform: 'translateX(-50%)',
                background: '#fff', color: '#000', fontSize: 9,
                fontFamily: MONO, padding: '2px 4px', borderRadius: 3,
                marginBottom: 2, whiteSpace: 'nowrap', fontWeight: 600,
              }}>
                {v}
              </div>
            )}
          </div>
        ))}
      </div>
    </Cell>
  );
}

function StreakWidget() {
  const [ref, vis] = useScrollReveal(0);
  const r = 26, circ = 2 * Math.PI * r, pct = 23 / 30;
  return (
    <Cell>
      <div
        ref={ref}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 4 }}
      >
        <div style={{ position: 'relative', width: 62, height: 62 }}>
          <svg width="62" height="62" viewBox="0 0 62 62" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="31" cy="31" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="31" cy="31" r={r} fill="none" stroke={A} strokeWidth="3"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - (vis ? pct : 0))}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1) 0.3s' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ ...wValue, fontSize: 20 }}>23</span>
          </div>
        </div>
        <span style={{ ...wLabel, fontSize: 9 }}>day streak</span>
      </div>
    </Cell>
  );
}

function MergeWidget() {
  const [ref, vis] = useScrollReveal(0);
  return (
    <Cell>
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <span style={wLabel}>merge rate</span>
        <span style={{ ...wValue, fontSize: 26, marginTop: 4, color: A }}>
          87<span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>%</span>
        </span>
        <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: A,
            width: vis ? '87%' : '0%',
            transition: 'width 1s cubic-bezier(0.4,0,0.2,1) 0.2s',
          }} />
        </div>
      </div>
    </Cell>
  );
}

function GoalWidget() {
  const [ref, vis] = useScrollReveal(0);
  return (
    <Cell>
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
        <span style={wLabel}>weekly goal</span>
        <span style={{ ...wValue, fontSize: 26, marginTop: 4 }}>
          84<span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>%</span>
        </span>
        <div style={{ marginTop: 8, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#f59e0b',
            width: vis ? '84%' : '0%',
            transition: 'width 1s cubic-bezier(0.4,0,0.2,1) 0.3s',
          }} />
        </div>
      </div>
    </Cell>
  );
}

function HeatmapMini() {
  const [ref, vis] = useScrollReveal(0);
  return (
    <Cell>
      <div ref={ref}>
        <span style={{ ...wLabel, display: 'block', marginBottom: 8 }}>heatmap</span>
        <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column', gap: 2 }}>
          {MINI.map((v, i) => (
            <div
              key={i}
              style={{
                width: 8, height: 8, borderRadius: 1.5,
                background: MC[v],
                opacity: vis ? 1 : 0,
                transform: vis ? 'scale(1)' : 'scale(0)',
                transition: `all 0.2s ease ${i * 4}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </Cell>
  );
}

function BentoGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 5,
        width: '100%',
        maxWidth: 380,
        overflowX: 'hidden',
        minWidth: 0,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 374px) {
              .lnd-root .lnd-bento-grid {
                grid-template-columns: 1fr !important;
                max-width: 100% !important;
              }
            }
          `,
        }}
      />

      <div className="lnd-bento-grid" style={{ display: 'contents' }}>
        <ChartWidget />
        <StreakWidget />
        <MergeWidget />
        <GoalWidget />
        <HeatmapMini />
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════ */
function HeroSection() {
  return (
    <section
      style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center',
        padding: 'clamp(100px, 12vh, 140px) clamp(24px,5vw,64px) 40px',
        gap: 'clamp(32px,5vw,80px)',
        flexWrap: 'wrap', justifyContent: 'center',
        position: 'relative', zIndex: 1,
        overflow: 'clip',
      }}
    >
      {/* Engineering Grid Texture */}
      <div 
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm1 1h38v38H1V1z' fill='%23ffffff' fill-opacity='0.02' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          maskImage: 'radial-gradient(ellipse at top, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top, black 20%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: -2,
        }}
      />

      {/* Ambient Animated Background Glow */}
      <div 
        style={{
          position: 'absolute',
          top: '20%', left: '10%',
          width: '60vw', height: '60vw',
          background: 'radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 60%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          animation: 'floatGlow 10s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      <div 
        style={{
          position: 'absolute',
          bottom: '-10%', right: '5%',
          width: '50vw', height: '50vw',
          background: 'radial-gradient(circle, rgba(55,48,163,0.2) 0%, transparent 60%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          animation: 'floatGlow2 12s ease-in-out infinite alternate',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatGlow {
          0% { transform: translate(0px, 0px) scale(1); opacity: 0.5; }
          100% { transform: translate(30px, -50px) scale(1.1); opacity: 0.8; }
        }
        @keyframes floatGlow2 {
          0% { transform: translate(0px, 0px) scale(1); opacity: 0.5; }
          100% { transform: translate(-40px, 40px) scale(1.2); opacity: 0.9; }
        }
        @keyframes zFloat {
          0% { transform: translateZ(20px); }
          100% { transform: translateZ(50px); }
        }
      `}} />

      {/* Left: text */}
      <div style={{ flex: '1 1 340px', maxWidth: 500, position: 'relative', zIndex: 2 }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
          borderRadius: 24, padding: '6px 14px', marginBottom: 28,
          boxShadow: '0 4px 14px rgba(129,140,248,0.1)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: A, letterSpacing: '0.08em', fontWeight: 600 }}>
            OPEN SOURCE · FREE FOREVER
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontFamily: DISP, fontWeight: 800,
            fontSize: 'clamp(44px,7vw,82px)', lineHeight: 0.95,
            letterSpacing: '-0.04em', margin: '0 0 24px',
            animation: 'lndHeroIn 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s both',
            background: 'linear-gradient(180deg, var(--foreground) 0%, color-mix(in srgb, var(--foreground) 70%, transparent) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 4px 24px rgba(0,0,0,0.8)',
          }}
        >
          YOUR<br />CODE<br />HAS A<br />
          <span style={{ 
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(129,140,248,0.4)',
          }}>PULSE</span>
          <span style={{ color: 'var(--foreground)' }}>.</span>
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: 'clamp(16px,2vw,18px)', color: 'var(--foreground)',
          lineHeight: 1.6, maxWidth: 420, margin: '0 0 40px',
          fontWeight: 400, letterSpacing: '0.01em', opacity: 0.85,
        }}>
          Open-source developer productivity dashboard. Track GitHub streaks,
          PR velocity, and coding goals — automatically.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/api/auth/signin/github?callbackUrl=/dashboard" prefetch={false} className="lnd-cta-primary" style={{
            boxShadow: '0 8px 24px rgba(129,140,248,0.3)',
            transition: 'transform 0.3s, box-shadow 0.3s',
            transform: 'translateY(0)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(129,140,248,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(129,140,248,0.3)';
          }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Sign in with GitHub
          </Link>
          <a
            href="https://github.com/Priyanshu-byte-coder/devtrack"
            target="_blank"
            rel="noopener noreferrer"
            className="lnd-cta-secondary"
            style={{
              transition: 'transform 0.3s, background 0.3s',
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ★ Star on GitHub
          </a>
        </div>
      </div>

      {/* Right: bento window frame */}
      <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column',alignItems: 'flex-end', gap: 24, position: 'relative', zIndex: 2 }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          overflow: 'hidden',
          width: '100%',
          maxWidth: 420,
        }}>
          {/* Traffic Lights */}
          <div style={{
            display: 'flex', gap: 8, padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            background: 'rgba(0,0,0,0.2)',
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
          </div>
          {/* Bento Content */}
          <div style={{ padding: 20 }}>
            <BentoGrid />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   COMMIT TICKER
   ═══════════════════════════════════════════════════════════ */
function CommitTicker() {
  const doubled = [...COMMITS, ...COMMITS];
  return (
    <div className="group" style={{
      borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`,
      padding: '10px 0', overflow: 'hidden', background: BG,
    }}>
      <div className="lnd-ticker group-hover:[animation-play-state:paused]" style={{ display: 'flex', gap: 48, whiteSpace: 'nowrap' }}>
        {doubled.map((c, i) => (
          <span
            key={i}
            style={{
              fontFamily: MONO, fontSize: 12, color: 'var(--muted-foreground)',
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}
          >
            <span style={{ color: A, fontSize: 8 }}>●</span>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ABOUT SECTION
   ═══════════════════════════════════════════════════════════ */
function AboutHighlightCard({
  item,
  index,
  visible,
}: {
  item: typeof ABOUT_HIGHLIGHTS[0];
  index: number;
  visible: boolean;
}) {
  const Icon = item.icon;
  const [tiltRef, tiltStyle] = use3DTilt(12);

  return (
    <article
      ref={(el) => {
        // @ts-ignore
        tiltRef.current = el;
      }}
      className="lnd-about-card group relative overflow-hidden transition-all duration-500 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/20"
      style={{
        opacity: visible ? 1 : 0,
        transformStyle: 'preserve-3d',
        transformOrigin: 'top center',
        transform: visible ? tiltStyle.transform : `perspective(1000px) rotateX(-90deg)`,
        transition: visible ? tiltStyle.transition : `opacity 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 80}ms, transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 80}ms`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        cursor: 'pointer',
      }}
    >
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(129,140,248,0.12) 0%, transparent 70%)',
          mixBlendMode: 'screen',
          transform: 'translateZ(1px)',
        }}
      />
      <div style={{ transform: 'translateZ(30px)', transition: 'transform 0.3s ease-out', animation: 'zFloat 4s ease-in-out infinite alternate' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(129,140,248,0.12)',
          border: '1px solid rgba(129,140,248,0.28)',
          color: A, marginBottom: 18,
        }}>
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <h3 style={{
          fontFamily: DISP, fontWeight: 700,
          fontSize: 19, color: TEXT, margin: '0 0 10px',
          letterSpacing: 0,
        }}>
          {item.title}
        </h3>
        <p style={{ color: 'var(--foreground)', opacity: 0.85, fontSize: 14, lineHeight: 1.65, margin: 0 }}>
          {item.desc}
        </p>
      </div>
    </article>
  );
}

function AboutSection() {
  const [ref, vis] = useScrollReveal(0.12);

  return (
    <section
      id="about"
      ref={ref}
      aria-labelledby="about-heading"
      style={{
        padding: '88px clamp(20px,4vw,48px)',
        borderTop: '1px solid #1e293b',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'clamp(28px,5vw,64px)',
        alignItems: 'start',
        maxWidth: 1120,
        margin: '0 auto',
      }}>
        <div style={{
          opacity: vis ? 1 : 0,
          transform: vis ? 'translateY(0)' : 'translateY(18px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: A, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 22 }}>
            ABOUT DEVTRACK
          </div>
          <h2
            id="about-heading"
            style={{
              fontFamily: DISP, fontWeight: 800,
              fontSize: 42,
              color: TEXT, letterSpacing: 0,
              lineHeight: 1.05, margin: '0 0 20px',
            }}
          >
            A clearer home for your developer progress.
          </h2>
          <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.75, margin: '0 0 28px', maxWidth: 580 }}>
            DevTrack helps developers, open-source contributors, and teams understand how their GitHub work is moving. It brings activity, pull requests, streaks, goals, and public profile insights into one calm dashboard so new users can quickly see what the platform is for.
          </p>
          <a href="#features" className="lnd-cta-secondary">
            Explore features
          </a>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}>
          {ABOUT_HIGHLIGHTS.map((item, index) => (
            <AboutHighlightCard key={item.title} item={item} index={index} visible={vis} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   HEATMAP SECTION
   ═══════════════════════════════════════════════════════════ */
function HeatmapSection() {
  const [ref, vis] = useScrollReveal(0.05);
  return (
    <section ref={ref} style={{ padding: '64px clamp(20px,4vw,48px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          52 weeks of contributions
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--muted-foreground)' }}>less</span>
          {HC.map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c, border: `1px solid ${BORDER}` }} />
          ))}
          <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--muted-foreground)' }}>more</span>
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateRows: 'repeat(7, 13px)',
        gridAutoFlow: 'column', gap: 3,
        overflowX: 'auto', paddingBottom: 8,
      }}>
        {HEAT.map((v, i) => (
          <div
            key={i}
            className="lnd-heatmap-cell"
            style={{
              width: 13, height: 13, borderRadius: 2,
              background: HC[v],
              opacity: vis ? 1 : 0,
              transform: vis ? 'scale(1)' : 'scale(0)',
              transition: `all 0.2s ease ${Math.floor(i / 7) * 12}ms`,
            }}
          />
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATS ROW
   ═══════════════════════════════════════════════════════════ */

function StatItem({ value, label, delay }: { value: number; label: string; delay: number }) {
  const [ref, vis] = useScrollReveal(0.2);
  return (
    <div
      ref={ref}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(16px)',
        transition: `all 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      <div style={{
        fontFamily: MONO, fontWeight: 700,
        fontSize: 'clamp(32px,5vw,52px)', color: TEXT,
        lineHeight: 1, letterSpacing: '-0.03em',
      }}>
        <Counter end={value} active={vis} />
        <span style={{ color: 'var(--foreground)', fontSize: 'clamp(18px,3vw,28px)' }}>+</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

function StatsSection({ stats }: { stats: RepoStats }) {
  const items = [
    { value: stats.totalCommits,    label: 'COMMITS IN REPO' },
    { value: stats.mergedPRs,       label: 'PRS MERGED' },
    { value: stats.contributorCount,label: 'CONTRIBUTORS' },
    { value: stats.stars,           label: 'GITHUB STARS' },
  ];
  return (
    <section id="features" style={{
      padding: '64px clamp(20px,4vw,48px)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))',
      gap: 24,
      maxWidth: 1180,
      margin: '0 auto',
      borderTop: `1px solid ${BORDER}`,
    }}>
      {items.map((s, i) => (
        <StatItem key={s.label} value={s.value} label={s.label} delay={i * 80} />
      ))}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FEATURES LIST
   ═══════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: Flame,
    title: 'Commit streaks tracker',
    desc: 'Track your daily GitHub activity.',
  },
  {
    icon: GitPullRequest,
    title: 'PR analytics',
    desc: 'Monitor review velocity and merge rates.',
  },
  {
    icon: Goal,
    title: 'Weekly goals',
    desc: 'Set commit and PR targets and stay accountable.',
  },
  {
    icon: FolderGit2,
    title: 'Top repositories',
    desc: 'See where you contribute the most.',
  },
];

const WHY_DEVTRACK = [
  {
    icon: Goal,
    title: "Goal Tracking",
    desc: "Set coding goals and track progress automatically."
  },
  {
    icon: Brain,
    title: "AI Insights",
    desc: "Get AI-powered summaries and recommendations."
  },
  {
    icon: Trophy,
    title: "Year Wrapped",
    desc: "Review your yearly development journey."
  },
  {
    icon: Users,
    title: "Multi-Account Support",
    desc: "Manage multiple GitHub profiles in one place."
  },
  {
    icon: Server,
    title: "Self-Hosting",
    desc: "Run DevTrack on your own infrastructure."
  }
];

function FeatureCard({ f, index }: { f: typeof FEATURES[0]; index: number }) {
  const [ref, vis] = useScrollReveal(0.15);
  const Icon = f.icon as LucideIcon;

  return (
    <div
      ref={(el) => {
        // @ts-ignore
        ref.current = el;
      }}
      className="relative overflow-hidden"
      style={{
        display: 'flex', flexDirection: 'column', gap: 16,
        padding: '28px 24px', background: 'rgba(10, 10, 12, 0.7)', border: '1px solid #1e293b',
        borderRadius: 16, boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        opacity: vis ? 1 : 0,
        transformStyle: 'preserve-3d',
        transform: vis ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1), transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        transitionDelay: vis ? '0ms' : `${index * 50}ms`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        
      }}
    >
      
      <div style={{ 
        width: 56, height: 56, marginBottom: 12,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(129,140,248,0.04)',
        border: '1px solid rgba(129,140,248,0.08)'
      }}>
        <Icon size={28} strokeWidth={1.5} color="#818cf8" />
      </div>
      <h3 style={{
        fontFamily: DISP, fontWeight: 700,
        fontSize: 'clamp(18px,2.5vw,22px)', color: TEXT,
        letterSpacing: '-0.02em', margin: 0,
      }}>
        {f.title}
      </h3>
      <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, margin: 0 }}>
        {f.desc}
      </p>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section style={{
      padding: '80px clamp(20px,4vw,48px)',
      borderTop: '1px solid #1e293b',
      maxWidth: 1200, margin: '0 auto',
    }}>
      <div style={{
        fontFamily: MONO,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        marginBottom: 16,
        textAlign: 'center',
        background: 'linear-gradient(90deg, #818cf8, #2dd4bf)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: 'inline-block',
        width: '100%'
        }}>
        FEATURE PREVIEW
      </div>
      <p
        style={{
          textAlign: 'center',
          color: MUTED,
          maxWidth: 600,
          margin: '0 auto 50px auto',
          lineHeight: 1.6,
          fontSize: 15
        }}
       >
        Sign in with GitHub to access analytics, streak tracking,
        goals and repository insights.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
        {FEATURES.map((f, i) => (
          <FeatureCard key={f.title} f={f} index={i} />
        ))}
      </div>
    </section>
  );
}

function WhyDevTrackSection() {
  return (
    <section
      style={{
        padding: "80px clamp(20px,4vw,48px)",
        borderTop: "1px solid #1e293b",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 50,
        }}
      >
        <h2
          style={{
            fontFamily: DISP,
            fontSize: "clamp(32px,4vw,48px)",
            fontWeight: 800,
            color: TEXT,
            marginBottom: 12,
          }}
        >
          Why DevTrack?
        </h2>

        <p
          style={{
            color: MUTED,
            maxWidth: 700,
            margin: "0 auto",
          }}
        >
          Go beyond GitHub analytics with goal tracking,
          AI insights, yearly summaries, multi-account
          support, and self-hosting.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {WHY_DEVTRACK.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              style={{
                padding: "24px",
                border: "1px solid #1e293b",
                borderRadius: "16px",
                background: "rgba(10,10,12,0.7)",
              }}
            >
              <Icon
                size={28}
                color="#818cf8"
                style={{ marginBottom: 16 }}
              />

              <h3
                style={{
                  color: TEXT,
                  marginBottom: 10,
                  fontWeight: 700,
                }}
              >
                {item.title}
              </h3>

              <p
                style={{
                  color: MUTED,
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOW IT WORKS SECTION
   ═══════════════════════════════════════════════════════════ */
const STEPS = [
  { num: '1', title: 'Sign in', desc: 'Authenticate with your GitHub account.', icon: LogIn,href: '/api/auth/signin/github?callbackUrl=/dashboard' },
  { num: '2', title: 'View dashboard', desc: 'See your automatically generated stats.', icon: LayoutDashboard,href: '/dashboard' },
  { num: '3', title: 'Set goals', desc: 'Configure weekly targets to keep your streak alive.', icon: Target,href: '/dashboard/settings'
 },
];

function HowItWorksSection() {
  const [ref, vis] = useScrollReveal(0.2);
  return (
    <section
      id="how-it-works"
      ref={ref}
      style={{
        padding: '80px clamp(20px,4vw,48px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
        borderTop: '1px solid #1e293b',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"
      />
      <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 50, textAlign: 'center', background: 'linear-gradient(90deg, #2dd4bf, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block', width: '100%', position: 'relative' }}>
        HOW IT WORKS
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'center', maxWidth: 1100, width: '100%', marginBottom: 50, position: 'relative'
      }}>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
          <Link key={i} href={step.href} className="group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-indigo-500/15" style={{ flex: '1 1 300px', background: 'rgba(10, 10, 12, 0.7)', border: '1px solid #1e293b', borderRadius: 16, padding: '32px 24px', textAlign: 'center', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', cursor: 'default' }}>
            <div className="group-hover:border-indigo-500/40 transition-colors duration-300" style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', marginBottom: 24, border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(129,140,248,0.05)' }}>
              <Icon size={64} strokeWidth={1} color="#818cf8" className="group-hover:scale-110 transition-transform duration-700 ease-in-out opacity-90" />
            </div>
            <div className="group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-300 group-hover:border-indigo-500/40" style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: A, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontFamily: MONO, fontSize: 18, fontWeight: 700 }}>
              {step.num}
            </div>
            <h3 style={{ fontFamily: DISP, fontWeight: 700, fontSize: 20, color: TEXT, margin: '0 0 12px' }}>{step.title}</h3>
            <p style={{ fontSize: 15, color: MUTED, margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
          </Link>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>
        <Link href="/api/auth/signin/github?callbackUrl=/dashboard" prefetch={false} className="lnd-cta-primary hover:scale-105 hover:shadow-indigo-500/30 transition-all duration-300">
          Sign in with GitHub
        </Link>
        <a
          href="https://github.com/Priyanshu-byte-coder/devtrack"
          target="_blank"
          rel="noopener noreferrer"
          className="lnd-cta-secondary"
        >
          ★ Star on GitHub
        </a>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--foreground)', marginTop: 20, letterSpacing: '0.06em' }}>
        MIT License · Self-hostable · Free forever · Zero vendor lock-in
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   OPEN SOURCE / CONTRIBUTE SECTION
   ═══════════════════════════════════════════════════════════ */
function ContributeSection({ stats }: { stats: RepoStats }) {
  const [ref, vis] = useScrollReveal(0.08);

  const statTiles = [
    { icon: '★', value: stats.stars,          suffix: '',  label: 'GITHUB STARS' },
    { icon: '⑂', value: stats.forks,          suffix: '',  label: 'FORKS' },
    { icon: '◎', value: stats.contributorCount, suffix: '+', label: 'CONTRIBUTORS' },
    { icon: '◈', value: stats.goodFirstIssues, suffix: '',  label: 'GOOD FIRST ISSUES' },
  ];

  return (
    <section
      ref={ref}
      style={{
        padding: '80px clamp(20px,4vw,48px)',
        borderTop: `1px solid ${BORDER}`,
        opacity: vis ? 1 : 0,
        transformStyle: 'preserve-3d',
        transformOrigin: 'top center',
        transform: vis ? 'perspective(1000px) rotateX(0)' : 'perspective(1000px) rotateX(-90deg)',
        transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Label */}
      <div style={{ fontFamily: MONO, fontSize: 10, color: A, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 40 }}>
        OPEN SOURCE
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: 12, marginBottom: 56 }}>
        {statTiles.map(s => (
          <div
            key={s.label}
            style={{
              background: 'color-mix(in srgb, var(--card) 40%, transparent)', border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '20px 20px 16px',
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', marginBottom: 10 }}>
              {s.icon} {s.label}
            </div>
            <div style={{
              fontFamily: MONO, fontWeight: 700,
              fontSize: 'clamp(26px,3.5vw,42px)', color: TEXT,
              lineHeight: 1, letterSpacing: '-0.03em',
            }}>
              <Counter end={s.value} active={vis} />
              {s.suffix && <span style={{ color: A, fontSize: '0.75em' }}>{s.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Headline + tagline */}
      <div style={{ maxWidth: 680, marginBottom: 40 }}>
        <h2 style={{
          fontFamily: DISP, fontWeight: 800,
          fontSize: 'clamp(28px,4vw,52px)', color: TEXT,
          letterSpacing: '-0.03em', lineHeight: 1.05,
          margin: '0 0 16px',
        }}>
          BUILT IN PUBLIC.<br />
          <span style={{ color: A }}>SHIP WITH US.</span>
        </h2>
        <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.7, margin: 0 }}>   {/* was '#555' */}
          DevTrack is fully open source — MIT licensed, self-hostable, and built by developers
          who actually use it. Every widget, every metric, every API was contributed by
          someone in this list. {stats.goodFirstIssues > 0 && (
            <span style={{ color: TEXT }}>
              {stats.goodFirstIssues}{" "} issues are tagged good&nbsp;first&nbsp;issue and waiting right now.
            </span>
          )}
        </p>
      </div>

      {/* Contributor avatars */}
      {stats.contributors.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: 40, gap: 0 }}>
          {stats.contributors.map((c, i) => (
            <a
              key={c.login}
              href={c.html_url}
              target="_blank"
              rel="noopener noreferrer"
              title={`@${c.login}`}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                border: `2px solid ${BG}`,
                marginLeft: i > 0 ? -11 : 0,
                overflow: 'hidden', display: 'block',
                position: 'relative', zIndex: stats.contributors.length - i,
                transition: 'transform 0.15s, z-index 0s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.transform = 'translateY(-5px) scale(1.15)';
                el.style.zIndex = '99';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.transform = 'translateY(0) scale(1)';
                el.style.zIndex = String(stats.contributors.length - i);
              }}
            >
              <Image
                src={c.avatar_url}
                alt={c.login}
                width={38}
                height={38}
                loading="lazy"
                style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </a>
          ))}
          {stats.contributorCount > stats.contributors.length && (
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              border: `2px solid #000000`,
              background: '#1e293b', marginLeft: -11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: MONO, fontSize: 10, color: '#cbd5e1', flexShrink: 0,
            }}>
              +{stats.contributorCount - stats.contributors.length}
            </div>
          )}
        </div>
      )}

      {/* CTA row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a
          href="https://github.com/Priyanshu-byte-coder/devtrack/issues?q=label%3A%22good+first+issue%22+is%3Aopen"
          target="_blank"
          rel="noopener noreferrer"
          className="lnd-cta-primary"
        >
          ◈ Browse Good First Issues
        </a>
        <a
          href="https://github.com/Priyanshu-byte-coder/devtrack/blob/main/CONTRIBUTING.md"
          target="_blank"
          rel="noopener noreferrer"
          className="lnd-cta-secondary"
        >
          CONTRIBUTING.md
        </a>
        <a
          href="https://github.com/Priyanshu-byte-coder/devtrack/fork"
          target="_blank"
          rel="noopener noreferrer"
          className="lnd-cta-secondary"
        >
          ⑂ Fork Repository
        </a>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   LANDING FOOTER  (above global Footer)
   ═══════════════════════════════════════════════════════════ */
function LandingFooter() {
  return (
    <footer 
      data-testid="landing-footer"
      style={{
        borderTop: `1px solid ${BORDER}`,   // was '#111'
        padding: '24px clamp(20px,4vw,48px)',
        display: 'flex', flexWrap: 'wrap', gap: '8px 32px',
        justifyContent: 'space-between', alignItems: 'center',
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>
        © {new Date().getFullYear()} DEVTRACK
      </span>
      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { label: 'GitHub', href: 'https://github.com/Priyanshu-byte-coder/devtrack' },
          { label: 'CONTRIBUTING.md', href: 'https://github.com/Priyanshu-byte-coder/devtrack/blob/main/CONTRIBUTING.md' },
          { label: 'LICENSE', href: 'https://github.com/Priyanshu-byte-coder/devtrack/blob/main/LICENSE' },
          { label: 'Issues', href: 'https://github.com/Priyanshu-byte-coder/devtrack/issues' },
        ].map(l => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="lnd-footer-link">
            {l.label}
          </a>
        ))}
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════ */
export default function LandingPage({ repoStats }: { repoStats: RepoStats }) {
  return (
    <div
      className="lnd-root"
      style={{ background: BG, color: TEXT, minHeight: '100vh', position: 'relative', overflowX: 'clip' }}
    >
      <MouseSpotlight />
      <HeroSection />
      <CommitTicker />
      <AboutSection />
      <HeatmapSection />
      <StatsSection stats={repoStats} />
      <FeaturesSection />
      <WhyDevTrackSection />
      <ContributeSection stats={repoStats} />
      <HowItWorksSection />
      <LandingFooter />
    </div>
  );
}