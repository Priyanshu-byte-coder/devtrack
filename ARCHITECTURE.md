# Architecture

## System Overview

DevTrack is a developer productivity dashboard built on Next.js App Router, TypeScript, Tailwind CSS, Supabase, and NextAuth.js. It aggregates GitHub activity, provides AI-powered insights, tracks coding goals, and surfaces leaderboards and community features.

**Key pieces:**
- GitHub OAuth via NextAuth.js for sign-in and access-token management
- 90+ Next.js route handlers under `src/app/api/` for all data fetching
- 50+ React components, organized into feature subdirectories under `src/components/`
- Supabase PostgreSQL for user records, goals, notifications, caching, and rooms
- Optional Upstash Redis for distributed caching across instances
- Optional Groq API for AI features (personality report, project tutor, weekly roast)
- Optional Anthropic API for AI-generated weekly summaries

---

## Folder Layout Overview

```
devtrack/
├── src/
│   ├── app/                    # Next.js App Router pages and route handlers
│   │   ├── api/                # 90+ route handlers
│   │   ├── dashboard/          # Authenticated dashboard and sub-pages
│   │   ├── leaderboard/        # Public leaderboard
│   │   ├── rooms/              # Collaborative rooms
│   │   ├── u/[username]/       # Public profile pages
│   │   ├── wrapped/            # Year in Code wrapped experience
│   │   ├── project-tutor/      # AI Project Tutor
│   │   ├── friend-compare/     # Friend comparison page
│   │   └── ...                 # Contact, compare, auth, landing, etc.
│   ├── components/             # React components (organized by feature)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Server-side utilities and service clients
│   ├── middleware.ts            # NextAuth-based route protection
│   └── types/                  # TypeScript type definitions
├── supabase/
│   ├── schema.sql              # Canonical DB schema (run once to initialize)
│   └── migrations/             # Incremental migration files
└── public/
    └── openapi.yaml            # OpenAPI 3.1 spec for all API routes
```

---

## Data Flow

```
Browser → Next.js route handler → GitHub REST/GraphQL API (with user's OAuth token)
                                → Supabase (goals, user settings, notifications, rooms)
                                → Groq / Anthropic (AI features, optional)
                                → Upstash Redis (caching layer, optional)
```

- Authentication: NextAuth reads the GitHub OAuth token from the JWT session. The route handler resolves the DevTrack user via `src/lib/resolve-user.ts`, then queries Supabase with the server-side admin client.
- Additional linked GitHub accounts have their tokens encrypted with `ENCRYPTION_KEY` before being stored in `user_github_accounts`.
- GitHub API calls use `cache: "no-store"` to prevent Next.js from staling OAuth tokens across users.
- Metrics are cached server-side in memory (and optionally in Redis) via `src/lib/metrics-cache.ts` using the `withMetricsCache` helper.

---

## Key Subsystems

### Auth
- NextAuth.js with GitHub provider (`src/lib/auth.ts`)
- Session contains `accessToken` (the user's GitHub OAuth token) and `githubId`
- On sign-in, the user is upserted into the Supabase `users` table
- Additional GitHub accounts can be linked via `/api/auth/link-github`
- Route protection is handled in `src/middleware.ts`
- OAuth tokens for linked accounts are AES-256-GCM encrypted with `ENCRYPTION_KEY`

### Metrics
- 30+ `/api/metrics/*` routes fetch GitHub REST and GraphQL data on demand
- Covers: contributions, PRs, streaks, repos, languages, achievements, CI, discussions, commit times, consistency scores, community engagement, repo health, inactive repos, and more
- Results are cached with per-endpoint TTLs in `src/lib/metrics-cache.ts`
- Cache reads in-memory first, falls back to Upstash Redis if configured

### Goals
- `/api/goals` — CRUD for weekly coding goals stored in Supabase
- `/api/goals/history` — Weekly rollup history
- `/api/goals/sync` — Syncs goal progress against live GitHub metrics

### Notifications
- `/api/notifications` — In-app notification feed from Supabase
- `/api/notifications/discord-sync` — Sends alerts to a Discord webhook
- `/api/cron/weekly-digest` — Scheduled weekly digest emails via Resend

### Leaderboard
- `/api/leaderboard` — Public leaderboard ranked by GitHub activity
- `/api/leaderboard/rebuild` — Token-protected full rebuild (uses `LEADERBOARD_REBUILD_TOKEN`)
- Leaderboard cache helpers in `src/lib/leaderboard-cache.ts` and `src/lib/metrics-cache.ts`

### Rooms
- `/api/rooms/*` — Collaborative rooms CRUD (create, list, join, message, invite, members)
- Rooms data lives in Supabase; real-time messages use polling
- `src/lib/supabase-rooms.ts` — Supabase helpers for room queries

### Webhooks
- `/api/webhooks/github` — Receives GitHub push events; invalidates the affected user's metrics cache
- `/api/webhooks/custom/*` — User-configured outbound webhooks: create, update, delete, test, rotate secret, view deliveries, retry delivery
- `/api/webhooks/dispatch/metrics` — Internal dispatch endpoint for triggering SSE pushes

### Local Coding
- `/api/local-coding/keys` — API key management for the local editor plugin
- `/api/local-coding/stats` — Aggregated local coding stats from `local_coding_sessions`
- `/api/local-coding/sync` — Ingest coding sessions from the editor plugin

### AI Features
- `/api/personality` — AI Code Personality Report (deterministic scoring in `src/lib/personality-analysis.ts`, Groq for prose)
- `/api/ai/roast` — AI roast/hype of the user's coding style
- `/api/ai/weekly-summary` — AI-generated weekly summary (Groq/Anthropic)
- `/api/project-tutor` — AI Project Tutor powered by Groq
- `/api/cv/*` — CV generation and export powered by AI (`src/lib/cv/`)

### SSE (Server-Sent Events)
- `/api/stream` — Per-user SSE connection for real-time dashboard pushes
- `src/lib/sse.ts` — In-process registry of active SSE controllers; webhook dispatch calls `sendSSEEvent` to push events without polling

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only Supabase key, bypasses RLS |
| `NEXTAUTH_URL` | Yes | Canonical deployment URL, no trailing slash |
| `NEXTAUTH_SECRET` | Yes | Random secret for NextAuth JWTs |
| `GITHUB_ID` | Yes | GitHub OAuth App Client ID |
| `GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret |
| `ENCRYPTION_KEY` | Yes | 64 hex chars (32 bytes) for OAuth token encryption |
| `CRON_SECRET` | Yes | Bearer secret for scheduled cron endpoints |
| `GITHUB_WEBHOOK_SECRET` | Optional | HMAC secret for GitHub push webhook verification |
| `GITHUB_TOKEN` | Optional | PAT to raise GitHub API rate limits |
| `RESEND_API_KEY` | Optional | Resend API key for contact form and digest emails |
| `RESEND_FROM_EMAIL` | Optional | From address for outbound emails |
| `CONTACT_TO_EMAIL` | Optional | Delivery address for contact form submissions |
| `GROQ_API_KEY` | Optional | Groq API key for AI features |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key for AI weekly summaries |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis URL for distributed caching |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis token |
| `LEADERBOARD_REBUILD_TOKEN` | Optional | Auth token for the leaderboard rebuild endpoint |
| `LEADERBOARD_USER_CONCURRENCY` | Optional | Concurrent fetches during leaderboard builds (default: 5) |
| `WAKATIME_CLIENT_ID` | Optional | WakaTime OAuth Client ID |
| `WAKATIME_CLIENT_SECRET` | Optional | WakaTime OAuth Client Secret |

See `.env.example` for a ready-to-fill template with detailed descriptions.
