import {
  Activity,
  Brain,
  FileText,
  FolderGit2,
  GitPullRequest,
  GraduationCap,
  LayoutDashboard,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other routes that belong to this item (e.g. sub-pages). */
  match?: string[];
  highlight?: boolean;
};

export type NavSection = { label?: string; items: NavItem[] };

export const APP_NAV: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
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
      {
        href: "/dashboard/community",
        label: "Community",
        icon: Users,
        match: ["/dashboard/friends", "/dashboard/rooms"],
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        href: "/wrapped",
        label: "Year in Code",
        icon: Sparkles,
        highlight: true,
      },
      {
        href: "/dashboard/career-intelligence",
        label: "Resume",
        icon: FileText,
      },
      { href: "/dashboard/personality", label: "Personality", icon: Brain },
      {
        href: "/dashboard/project-tutor",
        label: "Project tutor",
        icon: GraduationCap,
      },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    label: "Account",
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
