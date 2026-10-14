export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export function formatPercentageChange(percent: number): string {
  if (percent > 0) return `+${percent}%`;
  return `${percent}%`;
}
