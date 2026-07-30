"use client";
import { useEffect, useState } from "react";
import {
  Menu,
  X,
  Flame,
  GitPullRequest,
  Target,
  AlertCircle,
  BarChart2,
  GitCommit,
  CalendarDays,
  Bot,
  Trophy,
} from "lucide-react";

const sections = [
  { id: "weekly-summary", label: "Weekly Summary", icon: CalendarDays },
  { id: "personal-records", label: "Personal Records", icon: Trophy },
  { id: "contribution", label: "Contributions", icon: GitCommit },
  { id: "pr-analytics", label: "PR Analytics", icon: GitPullRequest },
  { id: "top-repos", label: "Top Repos & Goals", icon: Target },
  { id: "recent-activity", label: "Recent Activity", icon: BarChart2 },
];

export default function DashboardSidebar() {
  const [activeId, setActiveId] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(id);
        },
        { threshold: 0.3 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <>
      <aside className="hidden lg:flex flex-col sticky top-8 ml-2 rounded-2xl gap-1 bg-[var(--card)] border border-[var(--border)] p-3 shadow-xs min-w-[48px] xl:min-w-[210px] backdrop-blur-md">
        <div
          className="text-sm font-extrabold tracking-wider uppercase text-[var(--accent)] mb-3 px-3 py-1 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent)]/10 text-xs font-bold">▲</span>
          <span className="hidden xl:inline">DevTrack</span>
        </div>
        {sections.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            title={label}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150 ${
              activeId === id
                ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--control-hover)]"
            }`}
          >
            <Icon size={18} className={activeId === id ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"} />
            <span className="hidden xl:inline">{label}</span>
          </a>
        ))}
      </aside>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-[var(--card)]/90 backdrop-blur-md border border-[var(--border)] shadow-sm text-[var(--foreground)]"
      >
        <Menu size={20} />
      </button>
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full z-50 w-64 bg-[var(--card)] border-r border-[var(--border)] p-5 shadow-2xl transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center mb-6 border-b border-[var(--border)] pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Navigation
          </span>
          <button onClick={() => setMobileOpen(false)} className="p-1 rounded-lg hover:bg-[var(--control-hover)] text-[var(--foreground)]">
            <X size={20} />
          </button>
        </div>

        {sections.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={handleNavClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-1 ${
              activeId === id
                ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--control-hover)]"
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </>
  );
}