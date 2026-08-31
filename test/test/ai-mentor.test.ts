import { describe, it, expect } from 'vitest';
import { analyzePatterns, computeTrends } from '@/lib/ai-mentor';

describe('analyzePatterns', () => {
  it('returns insight for large commits', () => {
    const metrics = {
      commits: [{ count: 20 }, { count: 15 }],
      streak: { activeDays: 2 },
      repos: [],
      prs: {
        avgMergeTimeDays: 0
      }
    };

    const result = analyzePatterns(metrics as any);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe('large-commits');
  });
});

describe('computeTrends', () => {
  it('returns up when second half commits are higher', () => {
    const metrics = {
      commits: [
        { count: 2 },
        { count: 3 },
        { count: 10 },
        { count: 12 }
      ],
      repos: [],
      streak: { activeDays: 1 }
    };

    const result = computeTrends(metrics as any);

    expect(result.direction).toBe('up');
  });

  it('returns down when first half commits are higher', () => {
    const metrics = {
      commits: [
        { count: 10 },
        { count: 12 },
        { count: 2 },
        { count: 1 }
      ],
      repos: [],
      streak: { activeDays: 1}
    };

    const result = computeTrends(metrics as any);

    expect(result.direction).toBe('down');
  });

  it('returns zero for empty commits', () => {
    const metrics = {
      commits: [],
      repos: [],
      streak: { activeDays: 1 }
    };

    const result = computeTrends(metrics as any);

    expect(result.percentage).toBe(0);
  });
});
