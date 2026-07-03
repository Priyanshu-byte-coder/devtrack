import { describe, it, expect } from 'vitest';

// Helper functions (from src/lib/streak-utils.ts)
function calculateStreak(contributions: Array<{ date: string; count: number }>): number {
  if (!contributions || contributions.length === 0) return 0;
  
  let streak = 0;
  const sorted = [...contributions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // Find the last contribution
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].count > 0) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

function getLongestStreak(contributions: Array<{ date: string; count: number }>): number {
  if (!contributions || contributions.length === 0) return 0;
  
  let currentStreak = 0;
  let longestStreak = 0;
  const sorted = [...contributions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  for (const day of sorted) {
    if (day.count > 0) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return longestStreak;
}

describe('Streak Utilities', () => {
  describe('calculateStreak', () => {
    it('returns 0 for empty contributions', () => {
      expect(calculateStreak([])).toBe(0);
    });

    it('returns correct streak for consecutive days', () => {
      const contributions = [
        { date: '2026-06-28', count: 1 },
        { date: '2026-06-29', count: 2 },
        { date: '2026-06-30', count: 1 },
      ];
      expect(calculateStreak(contributions)).toBe(3);
    });

    it('resets streak when a day has no contributions', () => {
      const contributions = [
        { date: '2026-06-28', count: 1 },
        { date: '2026-06-29', count: 0 },
        { date: '2026-06-30', count: 1 },
      ];
      expect(calculateStreak(contributions)).toBe(1);
    });

    it('handles unsorted contributions', () => {
      const contributions = [
        { date: '2026-06-30', count: 1 },
        { date: '2026-06-28', count: 1 },
        { date: '2026-06-29', count: 1 },
      ];
      expect(calculateStreak(contributions)).toBe(3);
    });
  });

  describe('getLongestStreak', () => {
    it('returns 0 for empty contributions', () => {
      expect(getLongestStreak([])).toBe(0);
    });

    it('returns correct longest streak', () => {
      const contributions = [
        { date: '2026-06-28', count: 1 },
        { date: '2026-06-29', count: 1 },
        { date: '2026-06-30', count: 0 },
        { date: '2026-07-01', count: 1 },
        { date: '2026-07-02', count: 1 },
      ];
      expect(getLongestStreak(contributions)).toBe(2);
    });

    it('handles all days with contributions', () => {
      const contributions = [
        { date: '2026-06-28', count: 1 },
        { date: '2026-06-29', count: 1 },
        { date: '2026-06-30', count: 1 },
      ];
      expect(getLongestStreak(contributions)).toBe(3);
    });
  });
});