export function getGoalProgressPercent(current: number, target: number) {
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((current / target) * 100)));
}

export function buildPublicGoalSharePath(username: string, goalId: string) {
  return `/u/${encodeURIComponent(username)}/goals/${encodeURIComponent(
    goalId
  )}`;
}

export function buildPublicGoalShareUrl(
  origin: string,
  username: string,
  goalId: string
) {
  return `${origin}${buildPublicGoalSharePath(username, goalId)}`;
}