# Changelog

All notable changes to DevTrack are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.2.0] — 2025-05-10

### Changed — Breaking
- **Removed Express backend** — all API logic moved into Next.js Route Handlers (`src/app/api/`)
- **Replaced Prisma + PostgreSQL** with Supabase JS client — no migration tooling needed, schema in `supabase/schema.sql`
- **Collapsed monorepo** — `client/` and `server/` removed; project now lives at repo root

### Added
- `src/app/api/metrics/contributions/route.ts` — live GitHub commit data (was mock)
- `src/app/api/metrics/prs/route.ts` — live GitHub PR analytics (was mock)
- `src/app/api/goals/route.ts` — GET + POST weekly goals persisted in Supabase
- `src/lib/supabase.ts` — Supabase admin client
- `supabase/schema.sql` — database schema for users, goals, metric_snapshots
- Loading skeletons on all dashboard components
- `signIn` callback in `auth.ts` upserts user into Supabase on first login

### Removed
- `server/` directory (Express, Prisma, JWT middleware)
- `client/` directory (moved to root)
- `NEXT_PUBLIC_API_URL` env var (no separate backend)

---

## [0.1.0] — 2025-05-10

### Added
- Next.js 14 (App Router) frontend scaffold with TypeScript and Tailwind CSS
- GitHub OAuth authentication via NextAuth.js
- `SessionProvider` wrapper and `session.accessToken` exposure via JWT callbacks
- Dashboard page with `ContributionGraph`, `PRMetrics`, and `GoalTracker` components
- GitHub API client (`client/src/lib/github.ts`) for fetching events and repos
- Express + TypeScript backend with `/api/v1/metrics/contributions` and `/api/v1/metrics/prs` endpoints
- JWT auth middleware (`requireAuth`) for protected API routes
- Prisma schema with `User`, `Goal`, and `MetricSnapshot` models (PostgreSQL)
- GitHub Actions CI — lint and type-check on every PR and push to `main`
- Issue templates: bug report, feature request, good-first-issue
- Pull request template with checklist
- `CONTRIBUTING.md` with branch naming, commit style, and review process
- `CODE_OF_CONDUCT.md` (Contributor Covenant)
- MIT License

### Fixed
- Missing NextAuth API route for App Router (`/api/auth/[...nextauth]/route.ts`) — GitHub sign-in returned 404 (fixes #7, by @Chris8115)

---

[0.1.0]: https://github.com/Priyanshu-byte-coder/devtrack/releases/tag/v0.1.0


### GSSoC Semantic Versioning Policy

#### Version Numbering
- **MAJOR** (x.0.0): Breaking changes to public API, database schema, or authentication flow. Requires prior architecture approval.
- **MINOR** (0.x.0): New features, new API endpoints, new components. Backward-compatible.
- **PATCH** (0.0.x): Bug fixes, documentation updates, refactoring, performance improvements. Backward-compatible.

#### GSSoC Contribution Guidelines
- All contributions must follow semantic versioning when updating package.json or CHANGELOG.md
- Feature additions → MINOR bump
- Bug fixes → PATCH bump
- Breaking changes → MAJOR bump (requires architecture review)

#### Changelog Entry Format
When adding your changes to CHANGELOG.md, use the following format:
```markdown
### Added
- Feature description (#issue-number)

### Fixed
- Bug fix description (#issue-number)

### Changed
- Refactoring or behavioral changes (#issue-number)
```

#### Examples
- New dashboard widget: `0.3.0 → 0.4.0` (MINOR)
- Fix rate limiting bug: `0.3.0 → 0.3.1` (PATCH)
- Database migration with breaking schema change: `0.3.0 → 1.0.0` (MAJOR)

Bumps follow minor or patch levels strictly for GSSoC contributions.
Major updates require prior architecture approval from maintainers.
