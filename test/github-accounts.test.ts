import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockSupabaseChain = {
  select: mockSelect,
  eq: mockEq,
  single: mockSingle,
};
const mockSupabaseAdmin = { from: vi.fn(() => mockSupabaseChain) };

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/crypto', () => ({ decryptToken: vi.fn() }));

describe('getLinkedAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockSupabaseAdmin.from = vi.fn(() => mockSupabaseChain);
  });

  it('returns empty array when no linked accounts exist', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });
    const { getLinkedAccounts } = await import('../src/lib/github-accounts');
    const result = await getLinkedAccounts('user1');
    expect(result).toEqual([]);
  });

  it('returns decrypted accounts from database rows', async () => {
    const { decryptToken } = await import('@/lib/crypto');
    (decryptToken as ReturnType<typeof vi.fn>).mockReturnValue('decrypted-token');
    mockEq.mockResolvedValue({
      data: [
        { github_id: '123', github_login: 'user1', access_token_encrypted: 'e1', access_token_iv: 'i1' },
        { github_id: '456', github_login: 'user2', access_token_encrypted: 'e2', access_token_iv: 'i2' },
      ],
      error: null,
    });
    const { getLinkedAccounts } = await import('../src/lib/github-accounts');
    const result = await getLinkedAccounts('user1');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ githubId: '123', githubLogin: 'user1', token: 'decrypted-token' });
    expect(result[1]).toEqual({ githubId: '456', githubLogin: 'user2', token: 'decrypted-token' });
  });

  it('filters out accounts where decryption returns null', async () => {
    const { decryptToken } = await import('@/lib/crypto');
    const returns = ['valid-token', null, 'another-token'];
    (decryptToken as ReturnType<typeof vi.fn>).mockImplementation(() => returns.shift());
    mockEq.mockResolvedValue({
      data: [
        { github_id: '1', github_login: 'a', access_token_encrypted: 'e1', access_token_iv: 'i1' },
        { github_id: '2', github_login: 'b', access_token_encrypted: 'e2', access_token_iv: 'i2' },
        { github_id: '3', github_login: 'c', access_token_encrypted: 'e3', access_token_iv: 'i3' },
      ],
      error: null,
    });
    const { getLinkedAccounts } = await import('../src/lib/github-accounts');
    const result = await getLinkedAccounts('user1');
    expect(result).toHaveLength(2);
  });

  it('throws error when database query fails', async () => {
    mockEq.mockResolvedValue({ data: null, error: new Error('DB down') });
    const { getLinkedAccounts } = await import('../src/lib/github-accounts');
    await expect(getLinkedAccounts('user1')).rejects.toThrow('Failed to fetch linked accounts');
  });
});

describe('getAllAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockSupabaseAdmin.from = vi.fn(() => mockSupabaseChain);
  });

  it('returns primary account when no linked accounts', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });
    const { getAllAccounts } = await import('../src/lib/github-accounts');
    const result = await getAllAccounts(
      { token: 'primary-token', githubId: '1', githubLogin: 'main' },
      'user1'
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ token: 'primary-token', githubId: '1', githubLogin: 'main' });
  });

  it('deduplicates linked account that matches primary githubId', async () => {
    const { decryptToken } = await import('@/lib/crypto');
    (decryptToken as ReturnType<typeof vi.fn>).mockReturnValue('linked-token');
    mockEq.mockResolvedValue({
      data: [
        { github_id: '1', github_login: 'main', access_token_encrypted: 'e1', access_token_iv: 'i1' },
        { github_id: '2', github_login: 'other', access_token_encrypted: 'e2', access_token_iv: 'i2' },
      ],
      error: null,
    });
    const { getAllAccounts } = await import('../src/lib/github-accounts');
    const result = await getAllAccounts(
      { token: 'primary-token', githubId: '1', githubLogin: 'main' },
      'user1'
    );
    expect(result).toHaveLength(2);
    expect(result[0].githubId).toBe('1');
    expect(result[1].githubId).toBe('2');
  });
});

describe('getAccountToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockSupabaseAdmin.from = vi.fn(() => mockSupabaseChain);
  });

  it('returns decrypted token when account exists', async () => {
    const { decryptToken } = await import('@/lib/crypto');
    (decryptToken as ReturnType<typeof vi.fn>).mockReturnValue('account-token');
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: { access_token_encrypted: 'enc', access_token_iv: 'iv' },
      error: null,
    });
    const { getAccountToken } = await import('../src/lib/github-accounts');
    const result = await getAccountToken('user1', '456');
    expect(result).toBe('account-token');
  });

  it('returns null when account not found', async () => {
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const { getAccountToken } = await import('../src/lib/github-accounts');
    const result = await getAccountToken('user1', 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when decryption fails', async () => {
    const { decryptToken } = await import('@/lib/crypto');
    (decryptToken as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('decrypt fail'); });
    mockEq.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: { access_token_encrypted: 'bad', access_token_iv: 'bad' },
      error: null,
    });
    const { getAccountToken } = await import('../src/lib/github-accounts');
    const result = await getAccountToken('user1', '456');
    expect(result).toBeNull();
  });
});

describe('mergeMetrics', () => {
  it('returns merged value when all results are fulfilled', async () => {
    const { mergeMetrics } = await import('../src/lib/github-accounts');
    const results: PromiseFulfilledResult<{ count: number }>[] = [
      { status: 'fulfilled', value: { count: 5 } },
      { status: 'fulfilled', value: { count: 3 } },
    ];
    const merged = mergeMetrics(results, (a, b) => ({ count: a.count + b.count }));
    expect(merged).toEqual({ count: 8 });
  });

  it('ignores rejected results and merges fulfilled', async () => {
    const { mergeMetrics } = await import('../src/lib/github-accounts');
    const results: PromiseSettledResult<{ count: number }>[] = [
      { status: 'fulfilled', value: { count: 5 } },
      { status: 'rejected', reason: new Error('fail') },
      { status: 'fulfilled', value: { count: 3 } },
    ];
    const merged = mergeMetrics(results, (a, b) => ({ count: a.count + b.count }));
    expect(merged).toEqual({ count: 8 });
  });

  it('returns null for empty results array', async () => {
    const { mergeMetrics } = await import('../src/lib/github-accounts');
    const merged = mergeMetrics([], (a: { count: number }, b: { count: number }) => ({ count: a.count + b.count }));
    expect(merged).toBeNull();
  });

  it('returns single fulfilled result without merging', async () => {
    const { mergeMetrics } = await import('../src/lib/github-accounts');
    const results: PromiseFulfilledResult<{ count: number }>[] = [
      { status: 'fulfilled', value: { count: 10 } },
    ];
    const merged = mergeMetrics(results, (a, b) => ({ count: a.count + b.count }));
    expect(merged).toEqual({ count: 10 });
  });
});

describe('getRateLimitRemaining and pickBestToken', () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getRateLimitRemaining', () => {
    it('returns rate limit remaining value when API succeeds', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resources: {
            core: {
              remaining: 4500,
            },
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getRateLimitRemaining } = await import('../src/lib/github-accounts');
      const result = await getRateLimitRemaining('test-token');
      expect(result).toBe(4500);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/rate_limit",
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-token",
            Accept: "application/vnd.github+json",
          },
        })
      );
    });

    it('returns 0 when API returns non-ok status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getRateLimitRemaining } = await import('../src/lib/github-accounts');
      const result = await getRateLimitRemaining('test-token');
      expect(result).toBe(0);
    });

    it('returns 0 when API response is missing remaining field', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { getRateLimitRemaining } = await import('../src/lib/github-accounts');
      const result = await getRateLimitRemaining('test-token');
      expect(result).toBe(0);
    });

    it('returns 0 when fetch throws an error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal("fetch", mockFetch);

      const { getRateLimitRemaining } = await import('../src/lib/github-accounts');
      const result = await getRateLimitRemaining('test-token');
      expect(result).toBe(0);
    });
  });

  describe('pickBestToken', () => {
    it('throws error when no tokens are provided', async () => {
      const { pickBestToken } = await import('../src/lib/github-accounts');
      await expect(pickBestToken([])).rejects.toThrow('No tokens available');
    });

    it('returns the token with the highest remaining rate limit', async () => {
      const mockFetch = vi.fn().mockImplementation((url, init) => {
        const token = init.headers.Authorization.split(' ')[1];
        let remaining = 0;
        if (token === 'token-1') remaining = 1000;
        if (token === 'token-2') remaining = 3000;
        if (token === 'token-3') remaining = 2000;

        return Promise.resolve({
          ok: true,
          json: async () => ({
            resources: {
              core: {
                remaining,
              },
            },
          }),
        });
      });
      vi.stubGlobal("fetch", mockFetch);

      const { pickBestToken } = await import('../src/lib/github-accounts');
      const result = await pickBestToken(['token-1', 'token-2', 'token-3']);
      expect(result).toBe('token-2');
    });

    it('parallelizes getRateLimitRemaining calls (Promise.all check)', async () => {
      const spy = vi.spyOn(Promise, 'all');
      
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resources: {
            core: {
              remaining: 100,
            },
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const { pickBestToken } = await import('../src/lib/github-accounts');
      await pickBestToken(['token-a', 'token-b']);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
