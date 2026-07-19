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
      <aside className="hidden lg:flex flex-col sticky top-8 ml-5 rounded-xl h-full gap-1 bg-[var(--control)] border-r border-[var(--border)] p-3 min-w-[48px] xl:min-w-[200px]">
        <div
          className="text-lg flex items-center font-bold text-[var(--foreground)] mb-4 px-3">
          Devtrack
        </div>
        {sections.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            title={label}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all hover:bg-[var(--background)] ${
              activeId === id
                ? "bg-[var(--background)] text-[var(--foreground)] font-semibold"
                : "text-[var(--foreground)] opacity-60"
            }`}
          >
            <Icon size={18} />
            <span className="hidden xl:inline">{label}</span>
          </a>
        ))}
      </aside>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--control)]/80 backdrop-blur-sm border border-[var(--border)] shadow-md"
      >
        <Menu size={20} />
      </button>
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div
        className={`lg:hidden fixed top-0 left-0 h-full z-50 w-64 bg-[var(--control)]/90 backdrop-blur-md border-r border-[var(--border)] p-4 shadow-xl transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Navigate
          </span>
          <button onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {sections.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            onClick={handleNavClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:bg-[var(--background)] mb-1 ${
              activeId === id
                ? "bg-[var(--background)] text-[var(--foreground)] font-semibold"
                : "text-[var(--foreground)] opacity-60"
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