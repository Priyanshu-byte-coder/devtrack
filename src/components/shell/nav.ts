import {
  Activity,
  Brain,
  Crown,
  FileText,
  FolderGit2,
  GitPullRequest,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Sparkles,
  Swords,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other routes that belong to this item (e.g. sub-pages). */
  match?: string[];
  /** A star item, like Year in Code. */
  highlight?: boolean;
};

export type NavSection = {
  label: string;
  /** Section colour key, a literal class so Tailwind sees it. */
  accent: string;
  items: NavItem[];
};

/**
 * The dashboard menu, grouped like a game's: the fun, competitive things
 * first, then your stats, your people, the extras and the options.
 */
export const APP_NAV: NavSection[] = [
  {
    label: "Play",
    accent: "[--nav-c:#f2c14e]",
    items: [
      { href: "/dashboard", label: "HQ", icon: LayoutDashboard },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
      {
        href: "/compare",
        label: "Duel a friend",
        icon: Swords,
      },
      { href: "/top", label: "Top devs", icon: Crown },
      {
        href: "/wrapped",
        label: "Year in Code",
        icon: Sparkles,
        highlight: true,
      },
    ],
  },
  {
    label: "Stats",
    accent: "[--nav-c:#6ba8ff]",
    items: [
      { href: "/dashboard/activity", label: "Activity", icon: Activity },
      {
        href: "/dashboard/pull-requests",
        label: "Pull requests",
        icon: GitPullRequest,
      },
      {
        href: "/dashboard/repositories",
        label: "Repositories",
        icon: FolderGit2,
        match: ["/dashboard/repo-health", "/dashboard/repo-comparison"],
      },
      { href: "/dashboard/goals", label: "Goals", icon: Target },
    ],
  },
  {
    label: "Power-ups",
    accent: "[--nav-c:#c77dff]",
    items: [
      {
        href: "/dashboard/career-intelligence",
        label: "AI resume",
        icon: FileText,
      },
      { href: "/dashboard/personality", label: "Personality", icon: Brain },
      {
        href: "/dashboard/project-tutor",
        label: "Project tutor",
        icon: GraduationCap,
      },
    ],
  },
  {
    label: "Options",
    accent: "[--nav-c:#94a3b8]",
    items: [{ href: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return [item.href, ...(item.match ?? [])].some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}

export function activeNavItem(pathname: string): NavItem | undefined {
  return APP_NAV.flatMap((section) => section.items).find((item) =>
    isNavItemActive(item, pathname)
  );
}
