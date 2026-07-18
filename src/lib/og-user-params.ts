import { normalizeGitHubUsername } from "./validate-github-username";

const MAX_NAME_LENGTH = 48;
const MAX_LANGUAGE_LENGTH = 24;
const MAX_METRIC_VALUE = 999999;

export type OgUserParams = {
  username: string;
  name: string;
  avatar: string;
  topLang: string;
  streak: number;
  commits: number;
};

function truncate(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeTextParam(
  value: string | null,
  fallback: string,
  maxLength: number
): string {
  if (!value) {
    return fallback;
  }

  return truncate(value, maxLength) || fallback;
}

function normalizeNonNegativeInteger(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(Math.floor(parsed), MAX_METRIC_VALUE);
}

export function normalizeOgUserParams(
  searchParams: URLSearchParams
): OgUserParams {
  const username =
    normalizeGitHubUsername(searchParams.get("username")) ?? "developer";
  const name = normalizeTextParam(
    searchParams.get("name"),
    username,
    MAX_NAME_LENGTH
  );
  const topLang = normalizeTextParam(
    searchParams.get("topLang"),
    "JavaScript",
    MAX_LANGUAGE_LENGTH
  );

  return {
    username,
    name,
    avatar: `https://github.com/${username}.png?size=200`,
    topLang,
    streak: normalizeNonNegativeInteger(searchParams.get("streak")),
    commits: normalizeNonNegativeInteger(searchParams.get("commits")),
  };
}
