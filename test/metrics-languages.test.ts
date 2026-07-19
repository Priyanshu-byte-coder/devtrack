import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/metrics/languages/route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { resolveAppUser } from '@/lib/resolve-user';
import { getAccountToken } from '@/lib/github-accounts';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock resolve-user
vi.mock('@/lib/resolve-user', () => ({
  resolveAppUser: vi.fn(),
}));

// Mock github-accounts
vi.mock('@/lib/github-accounts', () => ({
  getAccountToken: vi.fn(),
}));

// Mock Supabase
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn().mockImplementation((table: string) => {
  return {
    select: mockSelect,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

// Mock metrics cache
vi.mock('@/lib/metrics-cache', () => ({
  isMetricsCacheBypassed: vi.fn(() => false),
  metricsCacheKey: vi.fn((userId: string, endpoint: string, params: any) => {
    const paramStr = params ? Object.entries(params)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join('&') : '';
    return `metrics:${userId}:${endpoint}${paramStr ? ':' + paramStr : ''}`;
  }),
  withMetricsCache: vi.fn(async (_config, callback) => callback()),
  METRICS_CACHE_TTL_SECONDS: {
    languages: 3600,
  },
}));

// Global fetch mock
const originalFetch = global.fetch;
let fetchMock: any;

describe('Language Metrics Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    global.fetch = fetchMock;

    // Default successful session
    (getServerSession as any).mockResolvedValue({
      accessToken: 'test-token',
      githubLogin: 'test-user',
      githubId: 'user-123',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns 401 when no session', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/metrics/languages');

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when no accessToken', async () => {
    (getServerSession as any).mockResolvedValue({
      githubLogin: 'test-user',
    });
    const req = new NextRequest('http://localhost/api/metrics/languages');

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns complete language data when all repositories succeed', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              repository: {
                full_name: 'user/repo1',
              },
            },
            {
              repository: {
                full_name: 'user/repo2',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          TypeScript: 50000,
          JavaScript: 30000,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Python: 40000,
          TypeScript: 20000,
        }),
      });

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isComplete).toBe(true);
    expect(data.failedRepositoriesCount).toBe(0);
    expect(data.languages).toBeDefined();
    expect(Array.isArray(data.languages)).toBe(true);
    expect(data.languages.length).toBeGreaterThan(0);
  });

  it('tracks failed repository with 403 status', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              repository: {
                full_name: 'user/repo1',
              },
            },
            {
              repository: {
                full_name: 'user/repo2',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          TypeScript: 50000,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isComplete).toBe(false);
    expect(data.failedRepositoriesCount).toBe(1);
    expect(data.languages).toBeDefined();
  });

  it('tracks failed repository with 404 status', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              repository: {
                full_name: 'user/repo1',
              },
            },
            {
              repository: {
                full_name: 'user/repo-deleted',
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          TypeScript: 50000,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isComplete).toBe(false);
    expect(data.failedRepositoriesCount).toBe(1);
  });

  it('tracks multiple failed repositories', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { repository: { full_name: 'user/repo1' } },
            { repository: { full_name: 'user/repo2' } },
            { repository: { full_name: 'user/repo3' } },
            { repository: { full_name: 'user/repo4' } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ TypeScript: 50000 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Python: 30000 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isComplete).toBe(false);
    expect(data.failedRepositoriesCount).toBe(2);
    expect(data.languages).toBeDefined();
  });

  it('handles fetch exception for repository language request', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { repository: { full_name: 'user/repo1' } },
            { repository: { full_name: 'user/repo2' } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ TypeScript: 50000 }),
      })
      .mockRejectedValueOnce(new Error('Network timeout'));

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isComplete).toBe(false);
    expect(data.failedRepositoriesCount).toBe(1);
  });

  it('returns 502 when search API fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toBe('GitHub API error');
    expect(data.isComplete).toBe(false);
  });

  it('includes failed repositories in development mode', async () => {

    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'development';

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { repository: { full_name: 'user/repo1' } },
            { repository: { full_name: 'user/repo-broken' } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ TypeScript: 50000 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(data.failedRepositories).toBeDefined();
    expect(Array.isArray(data.failedRepositories)).toBe(true);
    expect(data.failedRepositories.length).toBe(1);
    expect(data.failedRepositories[0]).toHaveProperty('name', 'user/repo-broken');
    expect(data.failedRepositories[0]).toHaveProperty('statusCode', 403);
    expect(data.failedRepositories[0]).toHaveProperty('error');

    (process.env as Record<string, string>).NODE_ENV = originalEnv ?? '';
  });

  it('does not include failed repositories in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';   

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { repository: { full_name: 'user/repo1' } },
            { repository: { full_name: 'user/repo-broken' } },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ TypeScript: 50000 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

    const req = new NextRequest('http://localhost/api/metrics/languages');
    const res = await GET(req);
    const data = await res.json();

    expect(data.failedRepositories).toBeUndefined();
    expect(data.failedRepositoriesCount).toBe(1);

    (process.env as Record<string, string>).NODE_ENV = originalEnv ?? '';
  });

  it('handles linked account request', async () => {
    (resolveAppUser as any).mockResolvedValue({ id: 'app-user-123' });
    (getAccountToken as any).mockResolvedValue('linked-token');
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { github_login: 'linked-user' },
            error: null,
          }),
        }),
      }),
    });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ repository: { full_name: 'linked-user/repo1' } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ TypeScript: 50000 }),
      });

    const req = new NextRequest('http://localhost/api/metrics/languages?accountId=linked-user-456');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isComplete).toBe(true);
  });

  it('returns 404 when linked account not found', async () => {
    (resolveAppUser as any).mockResolvedValue({ id: 'app-user-123' });
    (getAccountToken as any).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/metrics/languages?accountId=non-existent');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Account not found');
  });
});
