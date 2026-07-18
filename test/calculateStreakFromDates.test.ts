import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateStreakFromDates } from '@/lib/streak';

describe('calculateStreakFromDates', () => {

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculateStreak: returns 0 for empty array strings', () => {
    const result = calculateStreakFromDates(new Set(), new Set());
    expect(result.current).toBe(0);
    expect(result.longest).toBe(0);
    expect(result.totalActiveDays).toBe(0);
    expect(result.lastCommitDate).toBeNull();
  });

  it('calculateStreak: returns 1 for single contribution today date', () => {
    const result = calculateStreakFromDates(new Set(['2026-05-23']), new Set());
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.totalActiveDays).toBe(1);
    expect(result.lastCommitDate).toBe('2026-05-23');
  });

  it('calculateStreak: returns 1 for single contribution yesterday date', () => {
    const result = calculateStreakFromDates(new Set(['2026-05-22']), new Set());
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
  });

  it('calculateStreak: returns 0 when last contribution older than yesterday', () => {
    const result = calculateStreakFromDates(new Set(['2026-05-20']), new Set());
    expect(result.current).toBe(0);
    expect(result.longest).toBe(1);
  });

  it('calculateStreak: computes longest milestone streak range correctly', () => {
    const activeDates = new Set([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-10',
      '2026-05-11',
      '2026-05-12',
      '2026-05-13',
    ]);
    const result = calculateStreakFromDates(activeDates, new Set());
    expect(result.longest).toBe(4);
  });

  it('calculateStreak: respects freeze dates in combined evaluation map', () => {
    const activeDates = new Set(['2026-05-01', '2026-05-02', '2026-05-04']);
    const freezeDates = new Set(['2026-05-03']);
    const result = calculateStreakFromDates(activeDates, freezeDates);
    expect(result.longest).toBe(4);
    expect(result.current).toBe(0);
    expect(result.freezeDates).toContain('2026-05-03');
  });

  it('calculateStreak: counts total active days properly across gaps', () => {
    const activeDates = new Set([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-05',
    ]);
    const freezeDates = new Set(['2026-05-04']);
    const result = calculateStreakFromDates(activeDates, freezeDates);
    expect(result.totalActiveDays).toBe(5);
  });

  it('calculateStreak: handles empty active dates with valid freeze dates', () => {
    const freezeDates = new Set(['2026-05-01', '2026-05-02']);
    const result = calculateStreakFromDates(new Set(), freezeDates);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
    expect(result.totalActiveDays).toBe(2);
  });

  it('calculateStreak: returns ongoing streak starting today date', () => {
    const activeDates = new Set(['2026-05-21', '2026-05-22', '2026-05-23']);
    const result = calculateStreakFromDates(activeDates, new Set());
    expect(result.current).toBe(3);
  });

  it('calculateStreak: handles intermediate structural gaps in dates array', () => {
    const activeDates = new Set(['2026-05-01', '2026-05-05', '2026-05-06']);
    const result = calculateStreakFromDates(activeDates, new Set());
    expect(result.longest).toBe(2);
    expect(result.totalActiveDays).toBe(3);
  });
});
