# GSSoC Badge API — Rate Limits Reference Manual

This document is the authoritative reference for rate limiting behaviour
across all DevTrack badge endpoints. It is intended for GSSoC contributors
who are integrating badges into their READMEs, building tooling around the
Badge API, or working on badge-related code.

---

## Table of Contents

1. [Overview](#overview)
2. [Rate Limit Policy](#rate-limit-policy)
3. [Endpoints Covered](#endpoints-covered)
4. [Rate Limit Headers](#rate-limit-headers)
5. [HTTP 429 Response](#http-429-response)
6. [GitHub API Rate Limits](#github-api-rate-limits)
7. [Caching Behaviour](#caching-behaviour)
8. [Best Practices for Contributors](#best-practices-for-contributors)
9. [Troubleshooting](#troubleshooting)
10. [Environment Variables](#environment-variables)
11. [Implementation Reference](#implementation-reference)

---

## Overview

DevTrack badge endpoints are **publicly accessible** — no authentication is
required to fetch a badge. To protect the service and the GitHub API quota
from abuse, each badge endpoint enforces two layers of rate limiting:

| Layer | Enforced by | Limit |
|---|---|---|
| **DevTrack badge rate limit** | `checkBadgeRateLimit()` in `src/lib/badge-rate-limit.ts` | 20 requests / minute / IP |
| **GitHub API rate limit** | GitHub's servers | 60 req/hr (unauthenticated) · 5000 req/hr (with token) |

---

## Rate Limit Policy

### DevTrack Badge Rate Limit

- **Scope:** Per IP address
- **Window:** 60 seconds (sliding window)
- **Limit:** **20 requests per minute per IP**
- **Applies to:** All `/api/badge/*` endpoints
- **Reset:** Automatically resets after the 60-second window expires

> **Note for GSSoC contributors:** The `BADGE_API.md` file mentions
> "100 requests per minute per IP" — the actual enforced limit in the
> source code (`X-RateLimit-Limit: 20`) is **20 requests per minute**.
> This document reflects the implemented behaviour.

### Why 20 requests/minute?

Each badge request triggers a live GitHub API call. At 20 req/min per IP,
a single user cannot exhaust the unauthenticated GitHub quota (60 req/hr)
within a single minute window.

---

## Endpoints Covered

### `GET /api/badge/commits`

Returns an SVG badge showing commits made this month.
| Parameter | Required | Description |
|---|---|---|
| `user` | ✅ Yes | GitHub username (case-insensitive) |

**Rate limit:** 20 req/min/IP  
**Cache:** `s-maxage=3600, stale-while-revalidate=86400`

---

### `GET /api/badge/streak-shield`

Returns an SVG badge showing the user's current commit streak.
**Rate limit:** 20 req/min/IP  
**Cache:** `max-age=3600, public`

---

## Rate Limit Headers

Every badge response includes the following headers regardless of whether
the request succeeded or was rate limited:

| Header | Type | Description |
|---|---|---|
| `X-RateLimit-Limit` | `integer` | Maximum requests allowed per window (20) |
| `X-RateLimit-Remaining` | `integer` | Requests remaining in current window |
| `X-RateLimit-Reset` | `unix timestamp` | When the current window resets (seconds since epoch) |

### Example — successful response headers

```http
HTTP/1.1 200 OK
Content-Type: image/svg+xml;charset=utf-8
Cache-Control: s-maxage=3600, stale-while-revalidate=86400
X-Content-Type-Options: nosniff
X-RateLimit-Remaining: 18
X-RateLimit-Reset: 1718800260
```

---

## HTTP 429 Response

When the rate limit is exceeded, the endpoint returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718800260
```

**Body:** Plain text — `Rate limit exceeded`

### How to handle 429 in code

```typescript
const res = await fetch('/api/badge/commits?user=octocat');

if (res.status === 429) {
  const retryAfter = Number(res.headers.get('Retry-After') ?? 60);
  console.warn(`Rate limited. Retry after ${retryAfter} seconds.`);
  await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  // retry the request
}
```

---

## GitHub API Rate Limits

Badge endpoints call the GitHub Search API internally. GitHub enforces its
own rate limits on top of DevTrack's limits:

| Token type | Rate limit |
|---|---|
| No token (unauthenticated) | 60 requests / hour |
| `GITHUB_TOKEN` set | 5 000 requests / hour |
| GitHub App installation token | 15 000 requests / hour |

### When GitHub rate limits are hit

If GitHub returns a `403` on the streak endpoint, the badge renders with
`stale: true` and returns streak data of `0` rather than failing hard.
The commits endpoint returns `0` commits in this case.

**Signs your deployment is hitting GitHub limits:**
- Badges showing `0` unexpectedly
- `403` errors in server logs for GitHub API calls
- High badge traffic without `GITHUB_TOKEN` set

---

## Caching Behaviour

DevTrack badge endpoints use aggressive CDN caching to reduce both
DevTrack server load and GitHub API calls:

| Endpoint | `Cache-Control` | Effective cache duration |
|---|---|---|
| `/api/badge/commits` | `s-maxage=3600, stale-while-revalidate=86400` | 1 hour fresh · 24 hours stale |
| `/api/badge/streak-shield` | `s-maxage=3600, stale-while-revalidate=86400` | 1 hour fresh · 24 hours stale |
| `/api/badge/streak` | `max-age=3600, public` | 1 hour |
| Error responses | `max-age=60, public` | 1 minute |

### What this means for contributors

- Embedding a badge in your README will **not** hit the rate limit on
  every page view — GitHub caches the image.
- Badge data updates approximately **once per hour**.
- If you just made commits and the badge hasn't updated, wait up to
  1 hour or append `?v=2` to bust the cache.

---

## Best Practices for Contributors

### Embedding badges safely

```markdown
<!-- ✅ Good — links to your profile -->
[![DevTrack Streak](https://devtrack-delta.vercel.app/api/badge/streak-shield?user=YOUR_USERNAME)](https://devtrack-delta.vercel.app/u/YOUR_USERNAME)
[![DevTrack Commits](https://devtrack-delta.vercel.app/api/badge/commits?user=YOUR_USERNAME)](https://devtrack-delta.vercel.app/u/YOUR_USERNAME)
```

### Avoid hammering the API in CI

```yaml
# ❌ Bad — fetches badge on every CI run
- run: curl https://devtrack-delta.vercel.app/api/badge/commits?user=me

# ✅ Good — use cached badge URLs from README, don't fetch in CI
```

### Self-hosting

If you run your own DevTrack instance, set `GITHUB_TOKEN` to increase
the GitHub API quota from 60 to 5000 req/hr:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Badge shows `Error` | GitHub API call failed | Check `GITHUB_TOKEN` is set; check GitHub status |
| Badge shows `0` commits/streak | GitHub rate limited (403) | Set `GITHUB_TOKEN`; wait for rate limit reset |
| HTTP 429 from DevTrack | >20 req/min from your IP | Wait for `Retry-After` seconds |
| Badge not updating | CDN cache still fresh | Wait 1 hour or append `?v=N` to URL |
| `Invalid GitHub username` (400) | Username failed validation | Check username contains only `[a-zA-Z0-9-]` |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Recommended | GitHub personal access token. Raises GitHub API limit from 60 to 5000 req/hr. |

Set in `.env.local` for local development:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

---

## Implementation Reference

| File | Purpose |
|---|---|
| `src/lib/badge-rate-limit.ts` | `checkBadgeRateLimit()` and `getBadgeClientIp()` — core rate limiting logic |
| `src/app/api/badge/commits/route.ts` | Commits badge endpoint |
| `src/app/api/badge/streak-shield/route.ts` | Streak shield badge endpoint |
| `src/app/api/badge/streak/route.ts` | Streak badge endpoint |
| `src/app/api/badge/badge-utils.ts` | `generateBadgeSVG()` — SVG generation shared utility |
| `BADGE_API.md` | High-level badge API overview (user-facing) |

---

## Related Documentation

- [BADGE_API.md](../BADGE_API.md) — User-facing badge documentation
- [docs/api.md](./api.md) — General API documentation
- [docs/caching.md](./caching.md) — Caching strategy across DevTrack
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guide for GSSoC