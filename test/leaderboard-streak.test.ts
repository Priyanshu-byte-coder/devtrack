import { describe, it, expect } from 'vitest';
import { dateDiffDays, toDateStr } from '@/lib/date-utils';
import { calculateCurrentStreak } from '@/lib/streak';

describe('calculateCurrentStreak', () => {
  it('returns 0 for empty dates array', () => {
    expect(calculateCurrentStreak([])).toBe(0);
  });

  it('returns 1 for single contribution today', () => {
    const today = toDateStr(new Date());
    expect(calculateCurrentStreak([today])).toBe(1);
  });

  it('returns 1 for single contribution yesterday', () => {
    const yesterday = toDateStr(new Date(Date.now() - 86400000));
    expect(calculateCurrentStreak([yesterday])).toBe(1);
  });

  it('returns 0 if last contribution is before yesterday', () => {
    const twoDaysAgo = toDateStr(new Date(Date.now() - 2 * 86400000));
    const threeDaysAgo = toDateStr(new Date(Date.now() - 3 * 86400000));
    expect(calculateCurrentStreak([threeDaysAgo, twoDaysAgo])).toBe(0);
  });

  it('returns correct streak count for consecutive days', () => {
    const dates: string[] = [];
    for (let i = 4; i >= 0; i--) {
      dates.push(toDateStr(new Date(Date.now() - i * 86400000)));
    }
    expect(calculateCurrentStreak(dates)).toBe(5);
  });

  it('last contribution must be today or yesterday to have active streak', () => {
    const threeDaysAgo = toDateStr(new Date(Date.now() - 3 * 86400000));
    const fourDaysAgo = toDateStr(new Date(Date.now() - 4 * 86400000));
    expect(calculateCurrentStreak([threeDaysAgo, fourDaysAgo])).toBe(0);
  });

  it('handles year boundary: Dec 31 to Jan 1 transition', () => {
    expect(dateDiffDays('2023-12-31', '2024-01-01')).toBe(1);
  });

  it('ignores duplicate dates (same day multiple commits)', () => {
    const today = toDateStr(new Date());
    expect(calculateCurrentStreak([today, today, today])).toBe(1);
  });

  it('returns 0 when last run does not end today or yesterday', () => {
    const dates = ['2024-07-01', '2024-07-02', '2024-07-03'];
    expect(calculateCurrentStreak(dates)).toBe(0);
  });
});

describe('dateDiffDays', () => {
  it('returns 1 for consecutive days', () => {
    expect(dateDiffDays('2024-07-01', '2024-07-02')).toBe(1);
  });

  it('returns -1 for reverse order', () => {
    expect(dateDiffDays('2024-07-02', '2024-07-01')).toBe(-1);
  });

  it('returns 0 for same day', () => {
    expect(dateDiffDays('2024-07-01', '2024-07-01')).toBe(0);
  });

  it('handles year boundary', () => {
    expect(dateDiffDays('2023-12-31', '2024-01-01')).toBe(1);
  });
});

describe('toDateStr', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date('2024-07-03T12:00:00Z');
    expect(toDateStr(date)).toBe('2024-07-03');
  });

  it('pads single-digit month and day', () => {
    const date = new Date('2024-01-05T00:00:00Z');
    expect(toDateStr(date)).toBe('2024-01-05');
  });
});
