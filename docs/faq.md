# Frequently Asked Questions

Answers to questions new contributors and self-hosters ask most often. For deeper setup detail, see [DEVELOPMENT.md](../DEVELOPMENT.md) and the [Self-Hosting Guide](./self-hosting.md).

## How do I configure GitHub OAuth?

1. Go to [GitHub → Settings → Developer Settings → OAuth Apps](https://github.com/settings/applications/new) and create a new OAuth App.
2. Set the **Authorization callback URL** to:
   - Local dev: `http://localhost:3000/api/auth/callback/github`
   - Production: `https://<your-domain>/api/auth/callback/github`
3. Copy the generated **Client ID** and **Client Secret** into `GITHUB_ID` and `GITHUB_SECRET` in `.env.local`.
4. Make sure `NEXTAUTH_URL` matches the base URL you're running on, and `NEXTAUTH_SECRET` is set (generate one with `openssl rand -base64 32`).

## Why is login not working?

This is almost always one of the following:

- **Callback URL mismatch** — the URL registered on your GitHub OAuth App must exactly match `NEXTAUTH_URL` + `/api/auth/callback/github`, including protocol and trailing slashes.
- **Missing/incorrect `NEXTAUTH_SECRET`** — sessions will silently fail without it.
- **Stale `.env.local`** — restart `pnpm dev` after changing any auth-related env vars; Next.js doesn't hot-reload env files.
- **Supabase RLS blocking the user row** — check that the relevant migrations from `supabase/migrations/` have been applied in order.

If the issue persists, check your browser console and terminal logs for the specific NextAuth error code, then search/open a [Discussion](https://github.com/Priyanshu-byte-coder/devtrack/discussions).

## How do I obtain Supabase credentials?

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API**.
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never expose this in client code or commit it)
4. Run all SQL files in `supabase/migrations/` via the Supabase SQL editor, in order, before starting the app.

## Why are GitHub metrics not loading?

- You're likely hitting **GitHub's unauthenticated API rate limit**. Set the optional `GITHUB_TOKEN` (a personal access token) in `.env.local` to raise the limit significantly.
- Check that your GitHub OAuth scopes were granted during sign-in — if you denied a permission, re-authenticate by signing out and back in.
- If you're self-hosting behind a proxy or firewall, confirm outbound requests to `api.github.com` aren't being blocked.
- Look at the server logs/terminal for the specific API error (403 usually means rate-limited; 401 means a token problem).

## How do I run tests?

```bash
# Unit tests
pnpm test

# End-to-end tests (Playwright, first-time setup)
npx playwright install --with-deps chromium
pnpm run test:e2e

# Run a single e2e spec
npx playwright test e2e/goals.spec.ts

# Visual regression tests
npx playwright test -c playwright.visual.config.mjs
```

E2E tests use mocked external calls (no real GitHub/Supabase credentials needed) and also run automatically on every PR via `.github/workflows/e2e.yml`.

## How can I contribute?

1. Browse [open issues](https://github.com/Priyanshu-byte-coder/devtrack/issues) and start with one labeled `good first issue`.
2. Comment on the issue to get assigned before starting work.
3. Fork the repo, branch off `main` (e.g. `feat/issue-42-description`), and open a PR.
4. Before pushing, make sure CI passes locally:
   ```bash
   pnpm run lint && pnpm run type-check
   ```
5. See [CONTRIBUTING.md](../CONTRIBUTING.md) for commit message style, branch naming conventions, and the review process.

Questions are welcome anytime in [Discussions](https://github.com/Priyanshu-byte-coder/devtrack/discussions).

## Which Node.js and pnpm versions are supported?

| Tool | Version | Check |
|------|---------|-------|
| Node.js | >= 20 | `node -v` |
| pnpm | >= 9 | `pnpm -v` |
| Git | any | `git --version` |

Install pnpm via `corepack enable` or `npm install -g pnpm` if you don't already have it.

If your local versions differ and you hit install/build errors, aligning your Node.js/pnpm version with the table above is the first thing to check.

## Testing reference

DevTrack ships a Playwright-based end-to-end suite covering the full user journey — OAuth sign-in, dashboard rendering, and API correctness. No real credentials needed; all external calls are mocked via `page.route()`.

| Spec file | Coverage |
|-----------|----------|
| `e2e/auth.spec.ts` | Landing page, sign-in button, OAuth redirect, unauthenticated redirects |
| `e2e/dashboard.spec.ts` | All 6 dashboard widgets render after mock login, no console errors |
| `e2e/goals.spec.ts` | Goal create/delete lifecycle with API payload verification |
| `e2e/streak.spec.ts` | Streak values display, freeze button triggers API call |
| `e2e/api.spec.ts` | Auth-gated API routes return 200/401 correctly |

The test server is configured in `playwright.config.mjs` and auto-starts on `http://127.0.0.1:3002` with placeholder credentials — no `.env.local` required.

Visual regression baselines are stored in `tests/snapshots/`. Use the same Linux/Chromium environment as CI to avoid OS-specific rendering differences. The suite uses a `1280x720` viewport and fails at >0.1% pixel difference:

```bash
# Run visual regression tests
npx playwright test -c playwright.visual.config.mjs

# Update baselines
npx playwright test -c playwright.visual.config.mjs --update-snapshots
```
