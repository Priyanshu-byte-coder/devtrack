import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStreakTracker, calculateActiveDayInsights, calculateMonthlyTrend } from '@/components/StreakTracker';

// Mock context and hooks
vi.mock('@/components/AccountContext', () => ({
  useAccount: () => ({
    selectedAccount: 'test-account',
  }),
}));

vi.mock('@/hooks/useCountUp', () => ({
  useCountUp: (val: number) => val,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('html-to-image', () => ({
  toPng: vi.fn().mockResolvedValue('data-url'),
}));

const mockStreakData = {
  current: 12,
  longest: 30,
  lastCommitDate: '2026-05-30',
  totalActiveDays: 45,
  freezeDates: ['2026-05-25'],
};

const mockContributionData = {
  days: 365,
  total: 100,
  data: {
    '2026-05-30': 3,
    '2026-05-29': 5,
    '2026-05-28': 1,
  },
};

const mockFreezeData = {
  hasFreeze: true,
  freezeDate: '2026-05-31',
};

describe('StreakTracker - useStreakTracker Hook & Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url.includes('/api/metrics/streak')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockStreakData),
        } as Response);
      }
      if (url.includes('/api/metrics/contributions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockContributionData),
        } as Response);
      }
      if (url === '/api/streak/freeze') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockFreezeData),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response);
    }));

    // Mock localStorage
    if (typeof window !== 'undefined') {
      const store: Record<string, string> = {};
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn().mockImplementation((key) => store[key] || null),
          setItem: vi.fn().mockImplementation((key, val) => { store[key] = val; }),
          removeItem: vi.fn().mockImplementation((key) => { delete store[key]; }),
          clear: vi.fn().mockImplementation(() => { for (const k in store) delete store[k]; }),
        },
        writable: true,
        configurable: true,
      });

      // Mock navigator.clipboard
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches streak metric data on hook mount', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { result } = renderHook(() => useStreakTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(mockStreakData);
    expect(result.current.contributionData).toEqual(mockContributionData);
    expect(result.current.freeze).toEqual(mockFreezeData);

    expect(fetchSpy).toHaveBeenCalledWith('/api/metrics/streak?accountId=test-account');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(fetchSpy).toHaveBeenCalledWith(`/api/metrics/contributions?days=365&accountId=test-account&timezone=${encodeURIComponent(timezone)}`);
    expect(fetchSpy).toHaveBeenCalledWith('/api/streak/freeze');
  });

  it('handles pipeline fetch failures gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network Fail')));

    const { result } = renderHook(() => useStreakTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("We couldn't load your streak data right now. Please try again in a moment.");
  });

  it('copies streak data formatted structural text to clipboard', async () => {
    const { result } = renderHook(() => useStreakTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const clipboardSpy = vi.spyOn(window.navigator.clipboard, 'writeText');

    await act(async () => {
      await result.current.handleCopy();
    });

    expect(clipboardSpy).toHaveBeenCalledWith(
      `🔥 DevTrack Stats\nCurrent streak: 12 days\nLongest streak: 30 days\nActive days: 45`
    );
    expect(result.current.copied).toBe(true);
  });

  it('applies streak freeze successfully', async () => {
    const { result } = renderHook(() => useStreakTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const fetchSpy = vi.spyOn(global, 'fetch');

    await act(async () => {
      await result.current.handleApplyFreeze();
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/streak/freeze', { method: 'POST' });
    expect(result.current.freeze).toEqual(mockFreezeData);
  });

  it('cancels streak freeze successfully', async () => {
    const { result } = renderHook(() => useStreakTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Requires programmatic confirmCancel to be true first
    act(() => {
      result.current.setConfirmCancel(true);
    });

    const fetchSpy = vi.spyOn(global, 'fetch');

    await act(async () => {
      await result.current.handleCancelFreeze();
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/streak/freeze', { method: 'DELETE' });
    expect(result.current.confirmCancel).toBe(false);
  });

  it('calculates milestone banner celebrations and dismissals', async () => {
    const { result } = renderHook(() => useStreakTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Mock milestone reached: current is 12, milestone 7 is met
    expect(result.current.currentMilestone).toBe(7);
    expect(result.current.shouldShowBanner).toBe(true);

    // Dismiss milestone banner
    act(() => {
      result.current.handleDismissBanner();
    });

    expect(result.current.lastCelebratedMilestone).toBe(7);
    expect(result.current.dismissedMilestones).toContain(7);
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      'devtrack:last-celebrated-milestone',
      '7'
    );
  });

  describe('calculateActiveDayInsights utility logic', () => {
    it('returns invalid dataset status when too few data points exist', () => {
      const result = calculateActiveDayInsights({});
      expect(result.isValid).toBe(false);

      const tinyData = { '2026-05-30': 5 };
      expect(calculateActiveDayInsights(tinyData).isValid).toBe(false);
    });

    it('calculates average commits and maps peak days correctly', () => {
      // Mock exactly 14+ days of data
      const data: Record<string, number> = {};
      const baseDate = new Date(2026, 4, 15); // May 15 2026 (Friday)
      for (let i = 0; i < 15; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // Give Sunday (day index 0) the highest commits
        data[key] = d.getDay() === 0 ? 10 : 2;
      }

      const result = calculateActiveDayInsights(data);
      expect(result.isValid).toBe(true);
      expect(result.peakDay?.label).toBe('Sunday');
      expect(result.peakDay?.avgCommits).toBeGreaterThan(2);
    });

    it('resolves ties alphabetically', () => {
      // Monday (day index 1) and Tuesday (day index 2) both have equal commits, others zero
      const data: Record<string, number> = {};
      const baseDate = new Date(2026, 4, 15);
      for (let i = 0; i < 20; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (d.getDay() === 1 || d.getDay() === 2) {
          data[key] = 5;
        } else {
          data[key] = 0;
        }
      }

      const result = calculateActiveDayInsights(data);
      expect(result.isValid).toBe(true);
      // Alphabetical order tiebreaker: 'Monday' comes before 'Tuesday'
      expect(result.peakDay?.label).toBe('Monday');
    });
  });

  describe('calculateMonthlyTrend utility logic', () => {
    it('returns invalid dataset status when total days count < 30', () => {
      const result = calculateMonthlyTrend({ days: 15, total: 10, data: {} });
      expect(result.isValid).toBe(false);
    });

    it('identifies first month tracked scenario', () => {
      const now = new Date();
      const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
      const contrib = {
        days: 30,
        total: 5,
        data: {
          [thisMonthKey]: 5,
        },
      };

      const result = calculateMonthlyTrend(contrib);
      expect(result.isValid).toBe(true);
      expect(result.text).toBe('First month tracked!');
      expect(result.colorClass).toContain('text-[var(--accent)]');
    });

    it('calculates positive and negative percentage trends correctly', () => {
      const now = new Date();
      const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
      
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-15`;

      // Positive trend: 3 active days this month vs 2 last month (+50%)
      const contribPositive = {
        days: 35,
        total: 20,
        data: {
          [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`]: 1,
          [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-02`]: 1,
          [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-03`]: 1,
          [`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`]: 1,
          [`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-02`]: 1,
        },
      };

      const trendPos = calculateMonthlyTrend(contribPositive);
      expect(trendPos.isValid).toBe(true);
      expect(trendPos.text).toBe('↑50% vs last month');
      expect(trendPos.colorClass).toContain('success');

      // Negative trend: 1 active day this month vs 2 last month (-50%)
      const contribNegative = {
        days: 35,
        total: 20,
        data: {
          [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`]: 1,
          [`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-01`]: 1,
          [`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-02`]: 1,
        },
      };

      const trendNeg = calculateMonthlyTrend(contribNegative);
      expect(trendNeg.isValid).toBe(true);
      expect(trendNeg.text).toBe('↓50% vs last month');
      expect(trendNeg.colorClass).toContain('destructive');
    });
  });
});
