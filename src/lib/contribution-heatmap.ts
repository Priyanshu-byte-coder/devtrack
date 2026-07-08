export interface HeatmapCell {
  date: Date;
  dateKey: string;
  count: number;
  inRange: boolean;
}

export const HEATMAP_CELL_SIZE = 14;
export const HEATMAP_CELL_GAP = 3;
export const HEATMAP_LABEL_WIDTH = 48;
export const HEATMAP_HEADER_HEIGHT = 20;
export const HEATMAP_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Absolute commit counts matching getHeatmapCellStyle thresholds. */
export const HEATMAP_LEGEND_COUNTS = [0, 1, 3, 6, 10] as const;

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCommitCount(count: number): string {
  return `${count} contribution${count === 1 ? "" : "s"}`;
}

export function formatCellTooltip(count: number, date: Date): string {
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatCommitCount(count)} on ${formattedDate}`;
}

export function buildHeatmap(
  days: number,
  contributions: Record<string, number>,
  fromDate?: string,
  toDate?: string
): HeatmapCell[] {
  let endDate: Date;
  let startDate: Date;

  if (fromDate && toDate) {
    endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);
    startDate = new Date(fromDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
  }

  const firstWeekStart = new Date(startDate);
  firstWeekStart.setDate(startDate.getDate() - startDate.getDay());
  firstWeekStart.setHours(0, 0, 0, 0);

  const lastWeekEnd = new Date(endDate);
  lastWeekEnd.setDate(endDate.getDate() + (6 - endDate.getDay()));
  lastWeekEnd.setHours(23, 59, 59, 999);

  const cells: HeatmapCell[] = [];
  const cursor = new Date(firstWeekStart);

  while (cursor <= lastWeekEnd) {
    const dateKey = formatDateKey(cursor);
    cells.push({
      date: new Date(cursor),
      dateKey,
      count: contributions[dateKey] ?? 0,
      inRange: cursor >= startDate && cursor <= endDate,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return cells;
}

export function buildMonthMarkers(
  cells: HeatmapCell[],
  weekCount: number
): Array<{ label: string; weekIndex: number }> {
  const markers: Array<{ label: string; weekIndex: number }> = [];
  const seenMonths = new Set<string>();

  for (let w = 0; w < weekCount; w++) {
    const weekCells = cells.slice(w * 7, (w + 1) * 7);

    for (const cell of weekCells) {
      if (!cell.inRange) continue;

      const monthKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}`;

      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        markers.push({
          label: monthFormatter.format(cell.date),
          weekIndex: w,
        });
        break;
      }
    }
  }

  return markers;
}

export function countInRangeCommits(cells: HeatmapCell[]): number {
  return cells.filter((cell) => cell.inRange).reduce((total, cell) => total + cell.count, 0);
}
