import { startOfWeek } from "date-fns/startOfWeek";
import { subWeeks } from "date-fns/subWeeks";

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Formats a date as "MMM D, YYYY" (e.g. "May 15, 2026").
 * @throws {Error} If the date is invalid.
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * Returns a relative time string ("Today", "Yesterday", "5 days ago")
 * or the absolute formatted date if 30+ days ago.
 * @throws {Error} If the date is invalid.
 */
export function formatRelativeDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - d.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  return formatDate(d);
}

/** Locale-formatted date string via toLocaleDateString(). */
export function formatDisplayDate(date: string | Date): string {
  return new Date(date).toLocaleDateString();
}

// ─── Arithmetic ──────────────────────────────────────────────────────────────

/**
 * Formats a Date as an ISO 8601 calendar date string (YYYY-MM-DD) using UTC fields.
 */
export function toDateStr(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the number of calendar days between two dates using UTC midnights
 * to avoid DST boundary errors.
 * @throws {Error} If either date is invalid.
 */
export function daysBetween(
  a: Date | string | number,
  b: Date | string | number
): number {
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
    throw new Error("Invalid date");
  }
  const utcA = Date.UTC(
    dateA.getUTCFullYear(),
    dateA.getUTCMonth(),
    dateA.getUTCDate()
  );
  const utcB = Date.UTC(
    dateB.getUTCFullYear(),
    dateB.getUTCMonth(),
    dateB.getUTCDate()
  );
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

/**
 * Fractional day difference between two date strings (b − a).
 */
export function dateDiffDays(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}

/** Alias for dateDiffDays. */
export const dateDiff = dateDiffDays;

/**
 * Returns true if the given date is the current calendar day (local time).
 */
export function isToday(date: Date | string | number): boolean {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Returns true if the given date is the previous calendar day (local time).
 */
export function isYesterday(date: Date | string | number): boolean {
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

// ─── Week ranges ─────────────────────────────────────────────────────────────

function toUtcWallClock(date: Date): Date {
  return new Date(date.getTime() + date.getTimezoneOffset() * 60_000);
}

function fromUtcWallClock(date: Date): Date {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
}

function getUtcWeekStart(date: Date): Date {
  const utcWallClock = toUtcWallClock(date);
  const weekStart = startOfWeek(utcWallClock, { weekStartsOn: 1 });
  const utcWeekStart = fromUtcWallClock(weekStart);
  utcWeekStart.setUTCHours(0, 0, 0, 0);
  return utcWeekStart;
}

/**
 * Returns the start (Monday 00:00 UTC) and end (now at 23:59 UTC) of this week.
 */
export function getThisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const weekStart = getUtcWeekStart(now);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 0);
  return { start: weekStart.toISOString(), end: end.toISOString() };
}

/**
 * Returns the start (Monday 00:00 UTC) and end (Sunday 23:59 UTC) of last week.
 */
export function getLastWeekRange(): { start: string; end: string } {
  const thisWeekStart = getUtcWeekStart(new Date());
  const lastWeekStart = subWeeks(thisWeekStart, 1);
  lastWeekStart.setUTCHours(0, 0, 0, 0);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setUTCDate(lastWeekEnd.getUTCDate() - 1);
  lastWeekEnd.setUTCHours(23, 59, 59, 0);
  return { start: lastWeekStart.toISOString(), end: lastWeekEnd.toISOString() };
}

// ─── Timezone-aware streak helpers ───────────────────────────────────────────

/**
 * Returns the current local date string (YYYY-MM-DD) for a given IANA timezone.
 * Prevents streak miscalculation for users in non-UTC timezones.
 */
export function getLocalDateString(timezone: string = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Converts a UTC timestamp to a local date string (YYYY-MM-DD) for the given timezone.
 */
export function utcToLocalDate(
  utcTimestamp: string | Date,
  timezone: string = "UTC"
): string {
  const date =
    typeof utcTimestamp === "string" ? new Date(utcTimestamp) : utcTimestamp;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Returns true if two YYYY-MM-DD date strings are consecutive calendar days.
 */
export function areConsecutiveDays(
  date1: string,
  date2: string,
  timezone: string = "UTC"
): boolean {
  void timezone;
  const d1 = new Date(date1 + "T12:00:00Z");
  const d2 = new Date(date2 + "T12:00:00Z");
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24)) === 1;
}

/**
 * Calculates streak length from a sorted list of contribution dates (most recent first).
 *
 * @param dates - Array of YYYY-MM-DD strings, most recent first
 * @param userTimezone - IANA timezone string
 */
export function calculateStreak(
  dates: string[],
  userTimezone: string = "UTC"
): number {
  if (!dates || dates.length === 0) return 0;

  const today = getLocalDateString(userTimezone);
  // Compute yesterday properly to preserve the one-day grace period for streaks.
  // Calling getLocalDateString twice returns the same string; subtract one calendar
  // day using UTC arithmetic to avoid DST edge cases.
  const yesterday = (() => {
    const [year, month, day] = today.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return today;
    }
    const prev = new Date(Date.UTC(year, month - 1, day));
    prev.setUTCDate(prev.getUTCDate() - 1);
    const yyyy = prev.getUTCFullYear();
    const mm = String(prev.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(prev.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const uniqueDates = [...new Set(dates)].sort().reverse();

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    if (areConsecutiveDays(uniqueDates[i], uniqueDates[i - 1], userTimezone)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
