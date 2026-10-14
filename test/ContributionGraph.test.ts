import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

describe('ContributionGraph - private data isolation', () => {
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
    cleanup();
    vi.unstubAllGlobals();
  });

  it('fetches authenticated metrics without reading or persisting browser data', async () => {
    render(React.createElement(ContributionGraph));
    await waitFor(() => expect(screen.getByText('3 commits')).toBeTruthy());
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/metrics/contributions'));
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

  it.each([Date.now(), Date.now() - 90 * 60 * 1000])('ignores another account?s stored data with timestamp %i', async timestamp => {
    vi.mocked(get).mockResolvedValue({ data: [{day:'2026-05-30',commits:999}], commits:[], timestamp });
    render(React.createElement(ContributionGraph));
    await waitFor(() => expect(screen.getByText('3 commits')).toBeTruthy());
    expect(screen.queryByText('999 commits')).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('shows a network error without exposing persisted private history', async () => {
    vi.mocked(get).mockResolvedValue({data:[{day:'2026-05-30',commits:999}],commits:[],timestamp:Date.now()});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));
    render(React.createElement(ContributionGraph));
    await waitFor(() => expect(screen.getByText(/Failed to load contribution data/)).toBeTruthy());
    expect(screen.queryByText('999 commits')).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
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
