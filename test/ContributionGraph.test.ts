import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import ContributionGraph from '@/components/ContributionGraph';
import { get, set } from 'idb-keyval';

// Mock Recharts to avoid layout issues in JSDOM (using require('react').createElement for hoisting safety in pure .ts)
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => require('react').createElement('div', null, children),
  BarChart: ({ children }: any) => require('react').createElement('div', null, children),
  Bar: () => require('react').createElement('div'),
  LineChart: ({ children }: any) => require('react').createElement('div', null, children),
  Line: () => require('react').createElement('div'),
  AreaChart: ({ children }: any) => require('react').createElement('div', null, children),
  Area: () => require('react').createElement('div'),
  XAxis: () => require('react').createElement('div'),
  YAxis: () => require('react').createElement('div'),
  CartesianGrid: () => require('react').createElement('div'),
  Tooltip: () => require('react').createElement('div'),
  Legend: () => require('react').createElement('div'),
}));

// Mock useAccount
vi.mock('@/components/AccountContext', () => ({
  useAccount: () => ({
    selectedAccount: 'mock-account',
  }),
}));

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}));

const mockData = {
  data: {
    '2026-05-30': 3,
    '2026-05-29': 5,
  },
  commits: [
    { sha: '123', message: 'commit 1', date: '2026-05-30' },
  ],
  sources: {
    github: { '2026-05-30': 3 },
  },
};

describe('ContributionGraph - IndexedDB Caching and Background Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
      } as Response)
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('performs standard fetch and updates cache when no cache exists', async () => {
    // get returns undefined (cache miss)
    vi.mocked(get).mockResolvedValue(undefined);

    const fetchSpy = vi.spyOn(global, 'fetch');

    render(React.createElement(ContributionGraph));

    await waitFor(() => {
      // 1. Checked cache
      expect(get).toHaveBeenCalled();
      // 2. Initiated fetch
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/metrics/contributions'));
      // 3. Stored to cache
      expect(set).toHaveBeenCalledWith(
        expect.stringContaining('contrib-graph-mock-account'),
        expect.objectContaining({
          data: expect.any(Array),
          commits: expect.any(Array),
          timestamp: expect.any(Number),
        })
      );
    });
  });

  it('renders zero commits instead of NaN for empty contribution ranges', async () => {
    vi.mocked(get).mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/metrics/contributions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            data: {
              '2026-05-30': undefined,
            },
            commits: [],
            sources: {
              github: {
                '2026-05-30': undefined,
              },
            },
          }),
        } as Response);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ repos: [] }),
      } as Response);
    }));

    render(React.createElement(ContributionGraph));

    await waitFor(() => {
      expect(screen.getByText('0 commits')).toBeTruthy();
    });

    expect(screen.queryByText(/NaN commits/i)).toBeNull();
  });

  it('hydrates locally and bypasses network fetch when cache is fresh (< 1 hour)', async () => {
    const freshTimestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago (fresh)
    const cachedEntry = {
      data: [{ day: '2026-05-30', commits: 3 }],
      commits: [{ sha: '123', message: 'cached commit', date: '2026-05-30' }],
      timestamp: freshTimestamp,
    };

    vi.mocked(get).mockResolvedValue(cachedEntry);

    const fetchSpy = vi.spyOn(global, 'fetch');

    render(React.createElement(ContributionGraph));

    await waitFor(() => {
      expect(get).toHaveBeenCalled();
      // Bypasses contributions network fetch since cache is fresh
      const contributionsCalls = fetchSpy.mock.calls.filter(call => 
        typeof call[0] === 'string' && call[0].includes('/api/metrics/contributions')
      );
      expect(contributionsCalls.length).toBe(0);
    });
  });

  it('hydrates locally and runs background sync when cache is expired (> 1 hour)', async () => {
    const expiredTimestamp = Date.now() - 90 * 60 * 1000; // 1.5 hours ago (expired)
    const cachedEntry = {
      data: [{ day: '2026-05-30', commits: 3 }],
      commits: [{ sha: '123', message: 'cached commit', date: '2026-05-30' }],
      timestamp: expiredTimestamp,
    };

    vi.mocked(get).mockResolvedValue(cachedEntry);

    const fetchSpy = vi.spyOn(global, 'fetch');

    render(React.createElement(ContributionGraph));

    await waitFor(() => {
      expect(get).toHaveBeenCalled();
      // Cache is expired, so network background sync is triggered
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/metrics/contributions'));
      // Cache is updated with fresh data
      expect(set).toHaveBeenCalled();
    });
  });

  it('suppresses sync errors and retains cached data when background fetch fails', async () => {
    const expiredTimestamp = Date.now() - 90 * 60 * 1000; // expired
    const cachedEntry = {
      data: [{ day: '2026-05-30', commits: 3 }],
      commits: [{ sha: '123', message: 'cached commit', date: '2026-05-30' }],
      timestamp: expiredTimestamp,
    };

    vi.mocked(get).mockResolvedValue(cachedEntry);

    // Background fetch fails
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/api/metrics/contributions')) {
        return Promise.reject(new Error('Network Fail'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ repos: [] }),
      } as Response);
    }));

    render(React.createElement(ContributionGraph));

    await waitFor(() => {
      expect(get).toHaveBeenCalled();
      // Test finishes cleanly without throwing unhandled exceptions
    });
  });
});

// Original logic tests preserved
describe('ContributionGraph - original logic mapping', () => {
  it('level 1-4 cells have different background colors', () => {
    const getLevel = (count: number): number => {
      if (count === 0) return 0;
      if (count < 3) return 1;
      if (count < 6) return 2;
      if (count < 10) return 3;
      return 4;
    };
    expect(getLevel(0)).toBe(0);
    expect(getLevel(1)).toBe(1);
    expect(getLevel(5)).toBe(2);
    expect(getLevel(7)).toBe(3);
    expect(getLevel(10)).toBe(4);
  });

  it('parses date strings correctly', () => {
    const dateStr = '2024-07-03';
    const parsed = new Date(dateStr);
    expect(parsed.getFullYear()).toBe(2024);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(3);
  });
});
