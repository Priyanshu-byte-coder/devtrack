import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateCurrentStreak, calculateLongestStreak } from '@/lib/streak-utils';

describe('Streak Utilities', () => {
  describe('calculateCurrentStreak', () => {
    it('returns 0 for empty contributions', () => {
      expect(calculateCurrentStreak([])).toBe(0);
    });

    it('returns correct streak for consecutive days ending today', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const dates = [
        twoDaysAgo.toISOString().split('T')[0],
        yesterday.toISOString().split('T')[0],
        today.toISOString().split('T')[0],
      ];
      expect(calculateCurrentStreak(dates)).toBe(3);
    });

    it('returns 0 when last activity was more than 1 day ago', () => {
      const today = new Date();
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const dates = [
        threeDaysAgo.toISOString().split('T')[0],
      ];
      expect(calculateCurrentStreak(dates)).toBe(0);
    });

    it('handles Date objects', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dates = [yesterday, today];
      expect(calculateCurrentStreak(dates)).toBe(2);
    });

    it('handles unsorted dates', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const dates = [
        today.toISOString().split('T')[0],
        twoDaysAgo.toISOString().split('T')[0],
        yesterday.toISOString().split('T')[0],
      ];
      expect(calculateCurrentStreak(dates)).toBe(3);
    });

    it('handles duplicate dates', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const dates = [
        today.toISOString().split('T')[0],
        today.toISOString().split('T')[0],
        yesterday.toISOString().split('T')[0],
      ];
      expect(calculateCurrentStreak(dates)).toBe(2);
    });

    it('returns 0 for invalid dates', () => {
      const dates = ['invalid-date', '2024-01-01'];
      expect(calculateCurrentStreak(dates)).toBe(0);
    });
  });

  describe('calculateLongestStreak', () => {
    it('returns 0 for empty contributions', () => {
      expect(calculateLongestStreak([])).toBe(0);
    });

    it('returns correct longest streak', () => {
      const dates = [
        '2026-06-28',
        '2026-06-29',
        '2026-06-30',
        '2026-07-02',
        '2026-07-03',
      ];
      expect(calculateLongestStreak(dates)).toBe(3);
    });

    it('handles single-day streaks', () => {
      const dates = ['2026-06-28', '2026-06-30', '2026-07-02'];
      expect(calculateLongestStreak(dates)).toBe(1);
    });

    it('handles all days with contributions', () => {
      const dates = [
        '2026-06-28',
        '2026-06-29',
        '2026-06-30',
        '2026-07-01',
        '2026-07-02',
      ];
      expect(calculateLongestStreak(dates)).toBe(5);
    });

    it('handles Date objects', () => {
      const dates = [
        new Date('2026-06-28'),
        new Date('2026-06-29'),
        new Date('2026-06-30'),
      ];
      expect(calculateLongestStreak(dates)).toBe(3);
    });

    it('handles unsorted dates', () => {
      const dates = [
        '2026-06-30',
        '2026-06-28',
        '2026-06-29',
        '2026-07-01',
      ];
      expect(calculateLongestStreak(dates)).toBe(4);
    });

    it('handles duplicate dates', () => {
      const dates = [
        '2026-06-28',
        '2026-06-28',
        '2026-06-29',
        '2026-06-30',
      ];
      expect(calculateLongestStreak(dates)).toBe(3);
    });

    it('ignores invalid dates', () => {
      const dates = ['invalid-date', '2026-06-28', '2026-06-29'];
      expect(calculateLongestStreak(dates)).toBe(2);
    });
  });
});