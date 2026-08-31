import { describe, it, expect } from 'vitest';
import { formatActivity } from '../src/lib/activity-formatter';


describe('formatActivity', () => {
  const baseEvent = {
    id: '123',
    created_at: '2026-05-25T12:00:00Z',
    repo: { name: 'owner/repo' },
  };

  it('formats PushEvent with 1 commit correctly', () => {
    const event = {
      ...baseEvent,
      type: 'PushEvent',
      payload: {
        ref: 'refs/heads/main',
        commits: [ { sha: 'abc' } ],
        head: 'abc',
      },
    };
    const result = formatActivity(event as any);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Pushed 1 commit to main');
    expect(result?.type).toBe('push');
    expect(result?.url).toBe('https://github.com/owner/repo/commit/abc');
  });

  it('formats PushEvent with multiple commits correctly', () => {
    const event = {
      ...baseEvent,
      type: 'PushEvent',
      payload: {
        ref: 'refs/heads/feature-branch',
        commits: [ { sha: 'abc' }, { sha: 'def' }, { sha: 'ghi' } ],
        head: 'ghi',
      },
    };
    const result = formatActivity(event as any);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Pushed 3 commits to feature-branch');
    expect(result?.url).toBe('https://github.com/owner/repo/commit/ghi');
  });

  it('formats PullRequestEvent with action closed and merged=true', () => {
    const event = {
      ...baseEvent,
      type: 'PullRequestEvent',
      payload: {
        action: 'closed',
        pull_request: {
          number: 42,
          title: 'Add new feature',
          merged: true,
          html_url: 'https://github.com/owner/repo/pull/42',
        },
      },
    };
    const result = formatActivity(event as any);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Merged pull request #42');
    expect(result?.type).toBe('pull_request');
    expect(result?.subtitle).toBe('Add new feature');
    expect(result?.url).toBe('https://github.com/owner/repo/pull/42');
  });

  it('formats PullRequestEvent with action opened', () => {
    const event = {
      ...baseEvent,
      type: 'PullRequestEvent',
      payload: {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'Add new feature',
          merged: false,
          html_url: 'https://github.com/owner/repo/pull/42',
        },
      },
    };
    const result = formatActivity(event as any);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Opened pull request #42');
  });

  it('formats IssuesEvent with action closed', () => {
    const event = {
      ...baseEvent,
      type: 'IssuesEvent',
      payload: {
        action: 'closed',
        issue: {
          number: 7,
          title: 'Fix a big bug',
          html_url: 'https://github.com/owner/repo/issues/7',
        },
      },
    };
    const result = formatActivity(event as any);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Closed issue #7');
    expect(result?.type).toBe('issue');
    expect(result?.subtitle).toBe('Fix a big bug');
    expect(result?.url).toBe('https://github.com/owner/repo/issues/7');
  });

  it('formats ReleaseEvent published', () => {
    const event = {
      ...baseEvent,
      type: 'ReleaseEvent',
      payload: {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'First Release',
          html_url: 'https://github.com/owner/repo/releases/tag/v1.0.0',
        },
      },
    };
    const result = formatActivity(event as any);
    expect(result).not.toBeNull();
    expect(result?.title).toBe('Published v1.0.0');
    expect(result?.type).toBe('release');
    expect(result?.subtitle).toBe('First Release');
    expect(result?.url).toBe('https://github.com/owner/repo/releases/tag/v1.0.0');
  });

    it('returns null for unknown event type', () => {
      const event = {
        id: '123',
        type: 'UnknownFakeEventXYZ',
      };
      expect(formatActivity(event as any)).toBeNull();
    });

  it('returns null for event with no repo name', () => {
    const event = {
      id: '123',
      created_at: '2026-05-25T12:00:00Z',
      type: 'PushEvent',
      payload: {
        ref: 'refs/heads/main',
        commits: [ { sha: 'abc' } ],
      },
    };
    expect(formatActivity(event as any)).toBeNull();
  });
  it('formats PullRequestEvent with action closed but not merged', () => {
    const event = {
      ...baseEvent,
      type: 'PullRequestEvent',
      payload: {
        action: 'closed',
        pull_request: {
          number: 99,
          title: 'Fix navbar issue',
          merged: false,
          html_url: 'https://github.com/owner/repo/pull/99',
        },
      },
    };

    const result = formatActivity(event as any);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Closed pull request #99');
  });

  it('formats IssuesEvent with action opened', () => {
    const event = {
      ...baseEvent,
      type: 'IssuesEvent',
      payload: {
        action: 'opened',
        issue: {
          number: 15,
          title: 'New issue created',
          html_url: 'https://github.com/owner/repo/issues/15',
        },
      },
    };

    const result = formatActivity(event as any);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Opened issue #15');
  });

  it('formats ReleaseEvent with custom action', () => {
    const event = {
      ...baseEvent,
      type: 'ReleaseEvent',
      payload: {
        action: 'created',
        release: {
          tag_name: 'v2.0.0',
          name: 'Second Release',
          html_url: 'https://github.com/owner/repo/releases/tag/v2.0.0',
        },
      },
    };

    const result = formatActivity(event as any);

    expect(result).not.toBeNull();
    expect(result?.title).toBe('Created v2.0.0');
  });

  it('formats PushEvent without head commit url', () => {
    const event = {
      ...baseEvent,
      type: 'PushEvent',
      payload: {
        ref: 'refs/heads/dev',
        commits: [{ sha: 'abc' }],
      },
    };

    const result = formatActivity(event as any);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://github.com/owner/repo');
  });
});
