import { describe, it, expect } from 'vitest';
import { scoreAvgPrOpenTimeHours, computeHealthScore, scoreCommitFrequency, scorePrMergeRate, scoreOpenIssuesCount, scoreDaysSinceLastCommit } from '../src/lib/repo-health';
import type { RepoHealthSignals } from '../src/types/repo-health';

describe('gradeForScore', () => {
  const worstSignals: RepoHealthSignals = {
    commitFrequency: 0,
    prMergeRate: 0,
    avgPrOpenTimeHours: 9999,
    openIssuesCount: 9999,
    daysSinceLastCommit: 9999,
    contributorCount: 0,
    documentationScore: 0,
  };

  const bestSignals: RepoHealthSignals = {
    commitFrequency: 10,
    prMergeRate: 1,
    avgPrOpenTimeHours: 0,
    openIssuesCount: 0,
    daysSinceLastCommit: 0,
    contributorCount: 10,
    documentationScore: 100,
  };

  it('returns red for worst signals', () => {
    expect(
      computeHealthScore('repo', worstSignals).grade
    ).toBe('red');
  });

  it('returns green for perfect signals', () => {
    expect(
      computeHealthScore('repo', bestSignals).grade
    ).toBe('green');
  });

  it('handles Infinity', () => {
    const result = computeHealthScore('repo', {
      ...worstSignals,
      commitFrequency: Infinity,
    });

    expect(result.grade).toBeDefined();
  });

  it('handles -Infinity', () => {
    const result = computeHealthScore('repo', {
      ...worstSignals,
      commitFrequency: -Infinity,
    });

    expect(result.grade).toBeDefined();
  });

  it('handles NaN', () => {
    const result = computeHealthScore('repo', {
      ...worstSignals,
      commitFrequency: NaN,
    });

    expect(result.grade).toBeDefined();
  });
});

describe('scoreAvgPrOpenTimeHours', () => {
  it('returns 20 for 0-24 hours (full score)', () => {
    expect(scoreAvgPrOpenTimeHours(0)).toBe(20);
    expect(scoreAvgPrOpenTimeHours(12)).toBe(20);
  });

  it('returns 20 at exactly 24 hours boundary', () => {
    expect(scoreAvgPrOpenTimeHours(24)).toBe(20);
  });

  it('scales linearly between 24 and 168 hours', () => {
    // 24 hours = 20 points
    // 168 hours = 0 points
    // Halfway point: 96 hours = 10 points
    expect(scoreAvgPrOpenTimeHours(96)).toBe(10);
    
    // Quarter point: 60 hours = 15 points
    expect(scoreAvgPrOpenTimeHours(60)).toBe(15);
  });

  it('returns 0 at exactly 168 hours boundary', () => {
    expect(scoreAvgPrOpenTimeHours(168)).toBe(0);
  });

  it('returns 0 for >168 hours', () => {
    expect(scoreAvgPrOpenTimeHours(169)).toBe(0);
    expect(scoreAvgPrOpenTimeHours(200)).toBe(0);
  });

  it('handles non-finite values (Infinity, -Infinity, NaN)', () => {
    expect(scoreAvgPrOpenTimeHours(NaN)).toBe(0);
    expect(scoreAvgPrOpenTimeHours(Infinity)).toBe(0);
    expect(scoreAvgPrOpenTimeHours(-Infinity)).toBe(20);
  });

  it('handles negative hours gracefully', () => {
    expect(scoreAvgPrOpenTimeHours(-10)).toBe(20);
  });
});

describe('scoreCommitFrequency', () => {
  it('returns 0 for zero commits', () => {
    expect(scoreCommitFrequency(0)).toBe(0);
  });

  it('returns 25 for 10+ commits', () => {
    expect(scoreCommitFrequency(10)).toBe(25);
    expect(scoreCommitFrequency(15)).toBe(25);
  });

  it('scales linearly between 0 and 10 commits', () => {
    expect(scoreCommitFrequency(5)).toBe(12.5);
    expect(scoreCommitFrequency(2.5)).toBe(6.25);
  });

  it('handles negative values', () => {
    expect(scoreCommitFrequency(-5)).toBe(0);
  });

  it('handles non-finite values', () => {
    expect(scoreCommitFrequency(NaN)).toBe(0);
  });
});

describe('scorePrMergeRate', () => {
  it('returns 0 for 0% merge rate', () => {
    expect(scorePrMergeRate(0)).toBe(0);
  });

  it('returns 25 for 100% merge rate', () => {
    expect(scorePrMergeRate(1)).toBe(25);
  });

  it('scales linearly between 0 and 1', () => {
    expect(scorePrMergeRate(0.5)).toBe(12.5);
  });

  it('handles values outside 0-1 range', () => {
    expect(scorePrMergeRate(-0.5)).toBe(0);
    expect(scorePrMergeRate(1.5)).toBe(25);
  });
});

describe('scoreOpenIssuesCount', () => {
  it('returns 15 for 0 issues', () => {
    expect(scoreOpenIssuesCount(0)).toBe(15);
  });

  it('returns 0 for 20+ issues', () => {
    expect(scoreOpenIssuesCount(20)).toBe(0);
    expect(scoreOpenIssuesCount(50)).toBe(0);
  });

  it('scales linearly between 0 and 20', () => {
    expect(scoreOpenIssuesCount(10)).toBe(7.5);
  });

  it('handles negative values', () => {
    expect(scoreOpenIssuesCount(-5)).toBe(15);
  });
});

describe('scoreDaysSinceLastCommit', () => {
  it('returns 15 for 0 days', () => {
    expect(scoreDaysSinceLastCommit(0)).toBe(15);
  });

  it('returns 15 for 7 days', () => {
    expect(scoreDaysSinceLastCommit(7)).toBe(15);
  });

  it('returns 0 for 30+ days', () => {
    expect(scoreDaysSinceLastCommit(30)).toBe(0);
    expect(scoreDaysSinceLastCommit(100)).toBe(0);
  });

  it('scales linearly between 7 and 30 days', () => {
    expect(scoreDaysSinceLastCommit(18.5)).toBe(7.5);
  });

  it('handles negative values', () => {
    expect(scoreDaysSinceLastCommit(-5)).toBe(15);
  });
});
