export const DASHBOARD_LAYOUT_STORAGE_KEY = "devtrack.dashboard.layout.v1";

export type DashboardSectionId =
  | "overview"
  | "activity"
  | "analytics"
  | "goals";

export type DashboardWidgetId =
  | "weekly-summary"
  | "weekly-progress-summary"
  | "personal-records"
  | "ai-mentor"
  | "sponsor-analytics"
  | "contribution-graph"
  | "contribution-heatmap"
  | "repo-contribution-distribution"
  | "activity-ring"
  | "coding-activity-insights"
  | "streak-tracker"
  | "consistency-score"
  | "local-coding-time"
  | "coding-time"
  | "commit-time"
  | "commit-heatmap-time"
  | "productive-hours"
  | "repo-analytics"
  | "pr-metrics"
  | "pr-breakdown"
  | "pr-review-trend"
  | "discussions"
  | "community-metrics"
  | "pinned-repos"
  | "top-repos"
  | "inactive-repos"
  | "issue-metrics"
  | "goal-tracker"
  | "daily-note"
  | "recent-activity"
  | "ci-analytics"
  | "language-breakdown"
  | "friend-comparison"
  | "achievement-progress"
  | "guided-breathing";

export interface DashboardLayoutPreference {
  version: 1;
  sections: DashboardSectionId[];
  widgets: Record<DashboardSectionId, DashboardWidgetId[]>;
  hidden: DashboardWidgetId[];
}

export const DASHBOARD_SECTIONS: DashboardSectionId[] = [
  "overview",
  "activity",
  "analytics",
  "goals",
];

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  overview: "Overview",
  activity: "Activity & Coding",
  analytics: "Analytics & Repositories",
  goals: "Goals & Insights",
};

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  "weekly-summary": "Weekly Summary",
  "weekly-progress-summary": "Weekly Progress Summary",
  "personal-records": "Personal Records",
  "ai-mentor": "AI Mentor",
  "sponsor-analytics": "Sponsors Analytics",
  "contribution-graph": "Contribution Graph",
  "contribution-heatmap": "Contribution Heatmap",
  "repo-contribution-distribution": "Repository Contribution Distribution",
  "activity-ring": "Activity Ring",
  "coding-activity-insights": "Coding Activity Insights",
  "streak-tracker": "Streak Tracker",
  "consistency-score": "Consistency Score",
  "local-coding-time": "Local Coding Time",
  "coding-time": "Coding Time",
  "commit-time": "Commit Time",
  "commit-heatmap-time": "Commit Time Heatmap",
  "productive-hours": "Productive Hours",
  "repo-analytics": "Repository Analytics",
  "pr-metrics": "PR Metrics",
  "pr-breakdown": "PR Breakdown",
  "pr-review-trend": "PR Review Trend",
  discussions: "Discussions",
  "community-metrics": "Community Metrics",
  "pinned-repos": "Pinned Repositories",
  "top-repos": "Top Repositories",
  "inactive-repos": "Inactive Repositories",
  "issue-metrics": "Issue Metrics",
  "goal-tracker": "Goal Tracker",
  "daily-note": "Daily Note",
  "recent-activity": "Recent Activity",
  "ci-analytics": "CI Analytics",
  "language-breakdown": "Language Breakdown",
  "friend-comparison": "Friend Comparison",
  "achievement-progress": "Achievement Progress",
  "guided-breathing": "Guided Breathing Tool",
};

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutPreference = {
  version: 1,
  sections: ["overview", "activity", "analytics", "goals"],
  widgets: {
    overview: ["weekly-summary", "weekly-progress-summary", "personal-records", "ai-mentor", "sponsor-analytics"],
    activity: [
      "contribution-graph",
      "contribution-heatmap",
      "repo-contribution-distribution",
      "activity-ring",
      "coding-activity-insights",
      "streak-tracker",
      "consistency-score",
      "local-coding-time",
      "coding-time",
      "commit-time",
      "commit-heatmap-time",
      "productive-hours",
      "guided-breathing",
    ],
    analytics: [
      "repo-analytics",
      "pr-metrics",
      "pr-breakdown",
      "pr-review-trend",
      "discussions",
      "community-metrics",
      "pinned-repos",
      "top-repos",
      "inactive-repos",
    ],
    goals: [
      "issue-metrics",
      "goal-tracker",
      "daily-note",
      "recent-activity",
      "ci-analytics",
      "language-breakdown",
      "friend-comparison",
      "achievement-progress",
    ],
  },
  hidden: [],
};

const ALL_WIDGET_IDS = new Set<DashboardWidgetId>(
  Object.keys(DASHBOARD_WIDGET_LABELS) as DashboardWidgetId[],
);

const ALL_SECTION_IDS = new Set<DashboardSectionId>(DASHBOARD_SECTIONS);

const cloneLayout = (
  layout: DashboardLayoutPreference,
): DashboardLayoutPreference => ({
  version: 1,
  sections: [...layout.sections],
  widgets: {
    overview: [...layout.widgets.overview],
    activity: [...layout.widgets.activity],
    analytics: [...layout.widgets.analytics],
    goals: [...layout.widgets.goals],
  },
  hidden: [...layout.hidden],
});

export const getDefaultDashboardLayout = (): DashboardLayoutPreference =>
  cloneLayout(DEFAULT_DASHBOARD_LAYOUT);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDashboardWidgetId = (value: unknown): value is DashboardWidgetId =>
  typeof value === "string" && ALL_WIDGET_IDS.has(value as DashboardWidgetId);

const isDashboardSectionId = (value: unknown): value is DashboardSectionId =>
  typeof value === "string" && ALL_SECTION_IDS.has(value as DashboardSectionId);

const getDefaultSectionForWidget = (
  widgetId: DashboardWidgetId,
): DashboardSectionId => {
  for (const sectionId of DASHBOARD_SECTIONS) {
    if (DEFAULT_DASHBOARD_LAYOUT.widgets[sectionId].includes(widgetId)) {
      return sectionId;
    }
  }

  return "overview";
};

export const normalizeDashboardLayout = (
  value: unknown,
): DashboardLayoutPreference => {
  if (!isRecord(value)) {
    return getDefaultDashboardLayout();
  }

  const hidden = Array.isArray(value.hidden)
    ? Array.from(new Set(value.hidden.filter(isDashboardWidgetId)))
    : [];

  const hiddenSet = new Set(hidden);

  const sections = Array.isArray(value.sections)
    ? value.sections.filter(isDashboardSectionId)
    : DEFAULT_DASHBOARD_LAYOUT.sections;

  const normalizedSections =
    sections.length > 0
      ? Array.from(new Set([...sections, ...DASHBOARD_SECTIONS]))
      : [...DASHBOARD_SECTIONS];

  const rawWidgets = isRecord(value.widgets) ? value.widgets : {};

  const usedWidgets = new Set<DashboardWidgetId>();
  const widgets: Record<DashboardSectionId, DashboardWidgetId[]> = {
    overview: [],
    activity: [],
    analytics: [],
    goals: [],
  };

  for (const sectionId of DASHBOARD_SECTIONS) {
    const sectionWidgets = Array.isArray(rawWidgets[sectionId])
      ? rawWidgets[sectionId]
      : DEFAULT_DASHBOARD_LAYOUT.widgets[sectionId];

    for (const widgetId of sectionWidgets) {
      if (
        isDashboardWidgetId(widgetId) &&
        !usedWidgets.has(widgetId) &&
        !hiddenSet.has(widgetId)
      ) {
        widgets[sectionId].push(widgetId);
        usedWidgets.add(widgetId);
      }
    }
  }

  for (const sectionId of DASHBOARD_SECTIONS) {
    for (const widgetId of DEFAULT_DASHBOARD_LAYOUT.widgets[sectionId]) {
      if (!usedWidgets.has(widgetId) && !hiddenSet.has(widgetId)) {
        widgets[sectionId].push(widgetId);
        usedWidgets.add(widgetId);
      }
    }
  }

  return {
    version: 1,
    sections: normalizedSections,
    widgets,
    hidden,
  };
};

export const moveWidget = (
  layout: DashboardLayoutPreference,
  fromSection: DashboardSectionId,
  toSection: DashboardSectionId,
  widgetId: DashboardWidgetId,
  toIndex: number,
): DashboardLayoutPreference => {
  const next = cloneLayout(layout);

  next.widgets[fromSection] = next.widgets[fromSection].filter(
    (id) => id !== widgetId,
  );

  const safeIndex = Math.max(
    0,
    Math.min(toIndex, next.widgets[toSection].length),
  );

  next.widgets[toSection] = [
    ...next.widgets[toSection].slice(0, safeIndex),
    widgetId,
    ...next.widgets[toSection].slice(safeIndex),
  ];

  return normalizeDashboardLayout(next);
};

export const hideWidget = (
  layout: DashboardLayoutPreference,
  widgetId: DashboardWidgetId,
): DashboardLayoutPreference => {
  const next = cloneLayout(layout);

  for (const sectionId of DASHBOARD_SECTIONS) {
    next.widgets[sectionId] = next.widgets[sectionId].filter(
      (id) => id !== widgetId,
    );
  }

  if (!next.hidden.includes(widgetId)) {
    next.hidden.push(widgetId);
  }

  return normalizeDashboardLayout(next);
};

export const showWidget = (
  layout: DashboardLayoutPreference,
  widgetId: DashboardWidgetId,
): DashboardLayoutPreference => {
  const next = cloneLayout(layout);

  next.hidden = next.hidden.filter((id) => id !== widgetId);

  const defaultSection = getDefaultSectionForWidget(widgetId);
  const alreadyVisible = DASHBOARD_SECTIONS.some((sectionId) =>
    next.widgets[sectionId].includes(widgetId),
  );

  if (!alreadyVisible) {
    next.widgets[defaultSection].push(widgetId);
  }

  return normalizeDashboardLayout(next);
};

export const resetDashboardLayout = (): DashboardLayoutPreference =>
  getDefaultDashboardLayout();