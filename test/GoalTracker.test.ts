import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGoalTracker } from '@/components/GoalTracker';

const mockGoals = [
  {
    id: '1',
    title: 'Write Tests',
    target: 5,
    current: 2,
    unit: 'commits',
    recurrence: 'none' as const,
    deadline: null,
    is_public: false,
    period_start: '2026-05-30T00:00:00.000Z',
    last_synced_at: null,
    last_period: null,
  },
  {
    id: '2',
    title: 'Weekly Commit Goal',
    target: 10,
    current: 10,
    unit: 'commits',
    recurrence: 'weekly' as const,
    deadline: null,
    is_public: false,
    period_start: '2026-05-30T00:00:00.000Z',
    last_synced_at: '2026-05-30T00:00:00.000Z',
    last_period: null,
  }
];

describe('GoalTracker - useGoalTracker Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Stub fetch
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url === '/api/goals') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ goals: mockGoals }),
        } as Response);
      }
      if (url === '/api/goals/sync') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response);
    }));

    // Mock matchMedia
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads goals and handles auto-sync on mount', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { result } = renderHook(() => useGoalTracker());

    // Wait for initial load to finish
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.goals).toEqual(mockGoals);
    // Verified it loaded from '/api/goals'
    expect(fetchSpy).toHaveBeenCalledWith('/api/goals');
    // First goal (commits, last_synced_at is null) triggers auto-sync
    expect(fetchSpy).toHaveBeenCalledWith('/api/goals/sync', { method: 'POST' });
  });

  it('handles manual sync action handleSync', async () => {
    const { result } = renderHook(() => useGoalTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const fetchSpy = vi.spyOn(global, 'fetch');

    await act(async () => {
      await result.current.handleSync();
    });

    expect(result.current.syncing).toBe(false);
    expect(result.current.syncError).toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith('/api/goals/sync', { method: 'POST' });
    expect(fetchSpy).toHaveBeenCalledWith('/api/goals');
  });

  it('handles sync failures gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url === '/api/goals/sync') {
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ goals: [] }),
      } as Response);
    }));

    const { result } = renderHook(() => useGoalTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.handleSync();
    });

    expect(result.current.syncing).toBe(false);
    expect(result.current.syncError).toBe('Failed to sync goals. Please try again.');
  });

  it('handles creating a non-auto-synced goal successfully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, init) => {
      if (url === '/api/goals' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ goals: mockGoals }),
      } as Response);
    }));

    const { result } = renderHook(() => useGoalTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.setTitle('Read book');
      result.current.setTarget(5);
      result.current.setUnit('hours');
    });

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(result.current.title).toBe('');
    expect(result.current.createError).toBeNull();
  });

  it('handles goal creation failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, init) => {
      if (url === '/api/goals' && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              error: 'Task with this title already exists',
              code: 'DUPLICATE_TASK_TITLE',
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ goals: [] }),
      } as Response);
    }));

    const { result } = renderHook(() => useGoalTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.setTitle('Bad Goal');
    });

    await act(async () => {
      await result.current.handleCreate();
    });

    expect(result.current.createError).toBe('Task with this title already exists');
  });

  it('handles optimistic deletion and failure rollback', async () => {
    // Mock deletion failure
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, init) => {
      if (url.startsWith('/api/goals/') && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ goals: mockGoals }),
      } as Response);
    }));

    const { result } = renderHook(() => useGoalTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.goals).toHaveLength(2);

    await act(async () => {
      await result.current.handleDelete('2');
    });

    expect(result.current.deleteError).toBe('Failed to delete goal. Please try again.');
    // Restored the previous goals list on rollback
    expect(result.current.goals).toHaveLength(2);
  });

  it('triggers activeConfettiGoalId on completion transition', async () => {
    const { result } = renderHook(() => useGoalTracker());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Initial loaded goals contain id: '1' which is incomplete (2/5)
    // We update the state to simulate '1' becoming complete (5/5)
    act(() => {
      result.current.setGoals([
        {
          id: '1',
          title: 'Write Tests',
          target: 5,
          current: 5, // completed!
          unit: 'commits',
          recurrence: 'none',
          deadline: null,
          is_public: false,
          period_start: '2026-05-30T00:00:00.000Z',
          week_start: null,
          last_synced_at: null,
          last_period: null,
        }
      ]);
    });

    expect(result.current.activeConfettiGoalId).toBe('1');
  });

  describe('getCompletionLabel calculation bounds', () => {
    it('returns completed tags correctly', () => {
      const { result } = renderHook(() => useGoalTracker());

      const oneTime = { id: '1', current: 5, target: 5, recurrence: 'none' as const, deadline: null } as any;
      const weekly = { id: '2', current: 10, target: 10, recurrence: 'weekly' as const, deadline: null } as any;
      const monthly = { id: '3', current: 20, target: 20, recurrence: 'monthly' as const, deadline: null } as any;

      expect(result.current.getCompletionLabel(oneTime)).toBe('Completed ✓');
      expect(result.current.getCompletionLabel(weekly)).toBe('Completed this week ✓');
      expect(result.current.getCompletionLabel(monthly)).toBe('Completed this month ✓');
    });

    it('returns deadline-based tags correctly', () => {
      const { result } = renderHook(() => useGoalTracker());

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowGoal = { id: '1', current: 1, target: 5, recurrence: 'none' as const, deadline: tomorrow.toISOString() } as any;

      const todayGoal = { id: '2', current: 1, target: 5, recurrence: 'none' as const, deadline: new Date().toISOString() } as any;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayGoal = { id: '3', current: 1, target: 5, recurrence: 'none' as const, deadline: yesterday.toISOString() } as any;

      expect(result.current.getCompletionLabel(tomorrowGoal)).toContain('1d left');
      expect(result.current.getCompletionLabel(todayGoal)).toBe('Due today ⏳');
      expect(result.current.getCompletionLabel(yesterdayGoal)).toBe('Overdue ⚠️');
    });
  });
});
