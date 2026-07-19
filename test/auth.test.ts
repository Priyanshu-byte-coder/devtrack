import "./setup";
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin
const mockUpsert = vi.fn();
const mockSingle = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      upsert: (...args: any[]) => {
        mockUpsert(...args);
        return {
          select: vi.fn().mockReturnValue({
            single: () => mockSingle(),
          }),
        };
      },
    }),
  },
}));

vi.mock('@/lib/github-achievements', () => ({
  syncGitHubAchievementsForUser: vi.fn(),
}));

import { beforeAll } from 'vitest';

let authOptions: any;

beforeAll(async () => {
  process.env.NEXTAUTH_SECRET = 'test-secret';
  const mod = await import('../src/lib/auth');
  authOptions = mod.authOptions;
});

describe('auth.ts NextAuth callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: "user-id-123" }, error: null });
  });

  describe('signIn callback', () => {
    it('upserts user to Supabase on GitHub sign-in', async () => {
      const signInCallback = authOptions.callbacks?.signIn;
      if (!signInCallback) return;

      const result = await signInCallback({
        account: { provider: 'github', access_token: 'tok', token_type: 'Bearer' } as any,
        profile: { id: 12345, login: 'testuser' } as any,
        user: {},
      } as any);

      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          github_id: '12345',
          github_login: 'testuser',
        }),
        expect.objectContaining({ onConflict: 'github_id' })
      );
    });

    it('does not upsert for non-GitHub providers', async () => {
      const signInCallback = authOptions.callbacks?.signIn;
      if (!signInCallback) return;

      await signInCallback({
        account: { provider: 'google', access_token: 'tok' } as any,
        profile: { id: 123 } as any,
        user: {},
      } as any);

      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('returns true even if profile is missing', async () => {
      const signInCallback = authOptions.callbacks?.signIn;
      if (!signInCallback) return;

      const result = await signInCallback({
        account: { provider: 'github' } as any,
        profile: undefined,
        user: {},
      } as any);

      expect(result).toBe(true);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('passes correct github_id as string from profile', async () => {
      const signInCallback = authOptions.callbacks?.signIn;
      if (!signInCallback) return;

      await signInCallback({
        account: { provider: 'github' } as any,
        profile: { id: 999999, login: 'user99' } as any,
        user: {},
      } as any);

      const upsertCall = mockUpsert.mock.calls[0][0];
      expect(upsertCall.github_id).toBe('999999');
      expect(upsertCall.github_login).toBe('user99');
    });
  });

  describe('jwt callback', () => {
    it('attaches access_token to token.jwt', async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      if (!jwtCallback) return;

      const token: Record<string, any> = {};
      const result = await jwtCallback({
        token,
        account: { provider: 'github', access_token: 'github-token-abc' } as any,
        profile: undefined,
        user: {},
      } as any);

      expect(result.accessToken).toBe('github-token-abc');
    });

    it('does not attach accessToken if not present', async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      if (!jwtCallback) return;

      const token: Record<string, any> = {};
      const result = await jwtCallback({
        token,
        account: { provider: 'github' } as any,
        profile: undefined,
        user: {},
      } as any);

      expect(result.accessToken).toBeUndefined();
    });

    it('attaches githubId and githubLogin from profile', async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      if (!jwtCallback) return;

      const token: Record<string, any> = {};
      const result = await jwtCallback({
        token,
        account: null,
        profile: { id: 555, login: 'ghuser' } as any,
        user: {},
      } as any);

      expect(result.githubId).toBe('555');
      expect(result.githubLogin).toBe('ghuser');
    });

    it('returns token unchanged if no account or profile', async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      if (!jwtCallback) return;

      const token: Record<string, any> = { existing: 'value' };
      const result = await jwtCallback({ token, account: null, profile: undefined, user: {} } as any);

      expect(result.existing).toBe('value');
    });
  });

  describe('session callback', () => {
    it('populates session.accessToken from token.jwt', async () => {
      const sessionCallback = authOptions.callbacks?.session;
      if (!sessionCallback) return;

      const session: Record<string, any> = {};
      const token = { accessToken: 'jwt-token-xyz', githubId: '111', githubLogin: 'user1' } as any;
      const result = await sessionCallback({ session, token, user: {} } as any);

      expect((result as any).accessToken).toBe('jwt-token-xyz');
    });

    it('populates session.githubId from token.jwt', async () => {
      const sessionCallback = authOptions.callbacks?.session;
      if (!sessionCallback) return;

      const session: Record<string, any> = {};
      const token = { accessToken: 'tok', githubId: '222', githubLogin: 'user2' } as any;
      const result = await sessionCallback({ session, token, user: {} } as any);

      expect((result as any).githubId).toBe('222');
    });

    it('populates session.githubLogin from token.jwt', async () => {
      const sessionCallback = authOptions.callbacks?.session;
      if (!sessionCallback) return;

      const session: Record<string, any> = {};
      const token = { accessToken: 'tok', githubId: '333', githubLogin: 'user3' } as any;
      const result = await sessionCallback({ session, token, user: {} } as any);

      expect((result as any).githubLogin).toBe('user3');
    });

    it('does not set accessToken if not a string', async () => {
      const sessionCallback = authOptions.callbacks?.session;
      if (!sessionCallback) return;

      const session: Record<string, any> = {};
      const token = { accessToken: 123, githubId: '333' } as any;
      const result = await sessionCallback({ session, token, user: {} } as any);

      expect((result as any).accessToken).toBeUndefined();
    });

    it('does not set githubId if not a string', async () => {
      const sessionCallback = authOptions.callbacks?.session;
      if (!sessionCallback) return;

      const session: Record<string, any> = {};
      const token = { accessToken: 'tok', githubId: 999 } as any;
      const result = await sessionCallback({ session, token, user: {} } as any);

      expect((result as any).githubId).toBeUndefined();
    });
  });

  describe('authOptions configuration', () => {
    it('has jwt strategy configured', () => {
      expect(authOptions.session?.strategy).toBe('jwt');
    });

    it('has correct session max age (30 days)', () => {
      expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60);
    });

    it('has jwt max age configured', () => {
      expect(authOptions.jwt?.maxAge).toBe(30 * 24 * 60 * 60);
    });

    it('has GitHub provider configured with correct scope', () => {
      const githubProvider = authOptions.providers?.[0] as any;
      expect(githubProvider?.id).toBe('github');
      expect(githubProvider?.options?.authorization?.params?.scope).toBe('read:user user:email repo read:discussion read:org');
    });

    it('has NEXTAUTH_SECRET set', () => {
      expect(authOptions.secret).toBeDefined();
    });
  });
});
