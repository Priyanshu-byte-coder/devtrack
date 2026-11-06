import { describe, it, expect, vi, beforeEach } from 'vitest';

const decryptTokenMock = vi.fn();

vi.mock('@/lib/crypto', () => ({
  decryptToken: (...args: unknown[]) => decryptTokenMock(...args),
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn(),
      }),
    }),
  },
}));

import { supabaseAdmin } from '@/lib/supabase';
import { getLinkedAccounts, getAllAccounts, getAccountToken } from '../src/lib/github-accounts';

function mockLinkedAccountsRows(rows: Array<{ github_id?: string; github_login?: string; access_token_encrypted: string; access_token_iv: string }>) {
  const selectMock = vi.mocked(supabaseAdmin.from('user_github_accounts')).select as ReturnType<typeof vi.fn>;
  selectMock.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
  } as any);
}

describe('getLinkedAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decryptTokenMock.mockImplementation((encrypted: string) => {
      if (encrypted === 'FAIL') return null;
      return `decrypted-${encrypted}`;
    });
  });

  it('returns empty array when no linked accounts exist', async () => {
    mockLinkedAccountsRows([]);
    const result = await getLinkedAccounts('user-123');
    expect(result).toEqual([]);
  });

  it('returns all fields: githubId, githubLogin, token', async () => {
    mockLinkedAccountsRows([
      { github_id: 'gh-001', github_login: 'user1', access_token_encrypted: 'tok1', access_token_iv: 'iv1' },
    ]);
    const result = await getLinkedAccounts('user-123');
    expect(result).toHaveLength(1);
    expect(result[0].githubId).toBe('gh-001');
    expect(result[0].githubLogin).toBe('user1');
    expect(result[0].token).toBe('decrypted-tok1');
  });

  it('skips rows where decryptToken returns null', async () => {
    mockLinkedAccountsRows([
      { github_id: 'gh-001', github_login: 'user1', access_token_encrypted: 'FAIL', access_token_iv: 'iv1' },
      { github_id: 'gh-002', github_login: 'user2', access_token_encrypted: 'tok2', access_token_iv: 'iv2' },
    ]);
    const result = await getLinkedAccounts('user-123');
    expect(result).toHaveLength(1);
    expect(result[0].githubId).toBe('gh-002');
  });

  it('defaults missing github_id and github_login to empty string', async () => {
    mockLinkedAccountsRows([
      { access_token_encrypted: 'tok1', access_token_iv: 'iv1' },
    ]);
    const result = await getLinkedAccounts('user-123');
    expect(result).toHaveLength(1);
    expect(result[0].githubId).toBe('');
    expect(result[0].githubLogin).toBe('');
  });
});

describe('getAllAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decryptTokenMock.mockImplementation((encrypted: string) => {
      if (encrypted === 'FAIL') return null;
      return `decrypted-${encrypted}`;
    });
  });

  it('returns primary account at index 0', async () => {
    mockLinkedAccountsRows([]);
    const primary = { token: 'primary-token', githubId: 'gh-999', githubLogin: 'primaryuser' };
    const result = await getAllAccounts(primary, 'user-123');
    expect(result[0].githubId).toBe('gh-999');
    expect(result[0].githubLogin).toBe('primaryuser');
    expect(result[0].token).toBe('primary-token');
  });

  it('filters out primary account from linked accounts by githubId', async () => {
    mockLinkedAccountsRows([
      { github_id: 'gh-999', github_login: 'primaryuser', access_token_encrypted: 'tok1', access_token_iv: 'iv1' },
      { github_id: 'gh-001', github_login: 'user1', access_token_encrypted: 'tok2', access_token_iv: 'iv2' },
    ]);
    const primary = { token: 'primary-token', githubId: 'gh-999', githubLogin: 'primaryuser' };
    const result = await getAllAccounts(primary, 'user-123');
    const gh999Accounts = result.filter(a => a.githubId === 'gh-999');
    expect(gh999Accounts).toHaveLength(1);
    expect(result[0].githubId).toBe('gh-999');
    expect(result.length).toBe(2);
  });

  it('returns linked accounts after the primary', async () => {
    mockLinkedAccountsRows([
      { github_id: 'gh-001', github_login: 'user1', access_token_encrypted: 'tok1', access_token_iv: 'iv1' },
      { github_id: 'gh-002', github_login: 'user2', access_token_encrypted: 'tok2', access_token_iv: 'iv2' },
    ]);
    const primary = { token: 'primary-token', githubId: 'gh-999', githubLogin: 'primaryuser' };
    const result = await getAllAccounts(primary, 'user-123');
    expect(result).toHaveLength(3);
    expect(result[0].githubId).toBe('gh-999');
    expect(result[1].githubId).toBe('gh-001');
    expect(result[2].githubId).toBe('gh-002');
  });
});

describe('getAccountToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decryptTokenMock.mockImplementation((encrypted: string) => {
      if (encrypted === 'FAIL') return null;
      return `decrypted-${encrypted}`;
    });
  });

  function mockGetAccountTokenResponse(data: unknown, error: unknown) {
    const selectMock = vi.mocked(supabaseAdmin.from('user_github_accounts')).select as ReturnType<typeof vi.fn>;
    selectMock.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    } as any);
  }

  it('returns decrypted token for valid user+account combination', async () => {
    mockGetAccountTokenResponse(
      { access_token_encrypted: 'tok-abc', access_token_iv: 'iv-abc' },
      null
    );
    const result = await getAccountToken('user-123', 'gh-001');
    expect(result).toBe('decrypted-tok-abc');
  });

  it('returns null when account not found', async () => {
    mockGetAccountTokenResponse(null, 'not found');
    const result = await getAccountToken('user-123', 'gh-999');
    expect(result).toBeNull();
  });

  it('returns null when decryption fails', async () => {
    mockGetAccountTokenResponse(
      { access_token_encrypted: 'FAIL', access_token_iv: 'iv' },
      null
    );
    const result = await getAccountToken('user-123', 'gh-001');
    expect(result).toBeNull();
  });
});
