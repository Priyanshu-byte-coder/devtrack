# DevTrack Badge API

Live, animated pixel badges for your GitHub README. They are SVG images rendered from your current DevTrack data, so they update on their own.

<p>
  <img src="https://devtrack.live/api/badge/rank?user=priyanshu-byte-coder" alt="Example rank badge" height="72" />
  <img src="https://devtrack.live/api/badge/streak-shield?user=priyanshu-byte-coder" alt="Example streak badge" height="72" />
  <img src="https://devtrack.live/api/badge/commits?user=priyanshu-byte-coder" alt="Example commits badge" height="72" />
</p>

## Quick start

1. [Sign in to DevTrack](https://devtrack.live/auth/signin) with GitHub. New players start on the public leaderboard, which the rank badge needs.
2. Paste this into your profile README (the repository named after your username), replacing `YOUR_LOGIN`:

```md
[![DevTrack rank](https://devtrack.live/api/badge/rank?user=YOUR_LOGIN)](https://devtrack.live/u/YOUR_LOGIN)
[![Coding streak](https://devtrack.live/api/badge/streak-shield?user=YOUR_LOGIN)](https://devtrack.live/u/YOUR_LOGIN)
[![Commits this month](https://devtrack.live/api/badge/commits?user=YOUR_LOGIN)](https://devtrack.live/u/YOUR_LOGIN)
```

3. Commit. Linking each badge to your profile lets visitors open your full player card.

A step-by-step version lives at [devtrack.live/guides/github-stats-readme](https://devtrack.live/guides/github-stats-readme).

## Endpoints

All endpoints are public `GET` requests that return `image/svg+xml`. Usernames are case-insensitive.

### Rank badge

`GET /api/badge/rank?user=<login>[&board=all|month|week]`

Your rank on the leaderboard, tier, score, level progress and movement since the last daily snapshot.

| Parameter | Required | Values                          | Default |
| --------- | -------- | ------------------------------- | ------- |
| `user`    | yes      | GitHub username                 |         |
| `board`   | no       | `all`, `month` (season), `week` | `all`   |

- Ranked players get the full badge. Players who aren't on the public leaderboard (or haven't been included in a snapshot yet) get an "unranked" badge.
- A missing or invalid `user` returns the unranked badge with status `400`.
- Reads cached leaderboard snapshots, never the GitHub API, so it has no per-IP rate limit (every README view arrives from GitHub's few image-proxy addresses).

Implementation: `src/app/api/badge/rank/route.ts`, rendered by `src/lib/gamification/rank-badge.ts`.

### Streak badge

`GET /api/badge/streak-shield?user=<login>`

Your current streak, your best streak and the last seven days as pixel blocks.

### Commits badge

`GET /api/badge/commits?user=<login>`

Commits so far this month, with a bar for how far through the month we are.

For both the streak and commits badges:

- The user must have a DevTrack account. Other usernames get a "not on DevTrack" badge; invalid ones get an "invalid username" badge.
- They call the GitHub API, so they are rate limited per IP (see below).

Implementation: `src/app/api/badge/streak-shield/route.ts`, `src/app/api/badge/commits/route.ts`, rendered by `src/lib/gamification/stat-badge.ts` with the shared pixel primitives in `pixel-badge.ts`.

## Caching

GitHub serves README images through its camo proxy and would otherwise keep them for a long time, so every badge sends an explicit, short `Cache-Control` and an `ETag`:

| Badge   | Cache-Control                                                      |
| ------- | ------------------------------------------------------------------ |
| Rank    | `public, max-age=300, s-maxage=1800, stale-while-revalidate=86400` |
| Streak  | `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` |
| Commits | `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` |

Expect a change to show up within a few minutes on DevTrack, and a little longer inside a GitHub README. Error badges use shorter caches so a fixed problem clears quickly.

## Rate limits

The streak and commits badges allow **20 requests per minute per IP**, then return `429` with a `Retry-After` header. The rank badge has no per-IP limit. Details, headers and environment variables: [docs/badge-rate-limits.md](./docs/badge-rate-limits.md).

## Self-hosting

Badges work on any DevTrack deployment: swap `https://devtrack.live` for your own domain. The streak and commits badges need a GitHub token (`GITHUB_TOKEN` or a GitHub App) for reasonable API limits; the rank badge needs the daily gamification cron (`/api/cron/gamification`) to have written snapshots.

## Support

- Bugs: [open an issue](https://github.com/Priyanshu-byte-coder/devtrack/issues/new/choose)
- Questions: [Discussions](https://github.com/Priyanshu-byte-coder/devtrack/discussions)
