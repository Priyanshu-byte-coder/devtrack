# Development Guide

Everything you need to run DevTrack locally from scratch in under 10 minutes.

> **Just want to look around or change the public pages?** Skip all of this and run `pnpm install && pnpm dev:demo`. Demo mode serves the landing page, leaderboard, player cards, duels, top developers and guides on built-in sample data, with no Supabase project, GitHub OAuth app or API keys. You only need the steps below to work on the signed-in dashboard.

---

## Prerequisites

| Tool    | Version       | Check           |
| ------- | ------------- | --------------- |
| Node.js | >= 22.12 < 23 | `node -v`       |
| npm     | >= 10         | `npm -v`        |
| Git     | any           | `git --version` |

You also need free accounts on:

- [Supabase](https://supabase.com) — for the database
- GitHub — for OAuth (you already have this)
- [Resend](https://resend.com) — for the contact form and weekly digest emails

---

## 1. Clone and install

```bash
git clone https://github.com/Priyanshu-byte-coder/devtrack.git
cd devtrack
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm install --frozen-lockfile
```

---

## 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Pick a name, region, and database password — save the password somewhere
3. Wait ~1 minute for project to provision
4. Go to **SQL Editor** → **New Query**
5. Paste the full contents of `supabase/schema.sql` and click **Run**
6. Then run each file in `supabase/migrations/` **newer than** `20261011000000_canonical_schema.sql`, in filename order (today that's `20261102000000_gamification.sql`, which adds the leaderboard snapshots, XP and seasons). Skipping it breaks the leaderboard, rank badges and seasons. See the [database guide](supabase/README.md).
7. Go to **Project Settings → API** and copy three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** secret → `SUPABASE_SERVICE_ROLE_KEY`

### ⚠️ Security: SUPABASE_SERVICE_ROLE_KEY

The `service_role` key is a **database superkey** — it completely bypasses all Supabase Row Level Security (RLS) policies. Handle it with extreme care:

- **NEVER** use this key in client-side code (React components, browser scripts, or `NEXT_PUBLIC_` environment variables)
- **NEVER** commit it to version control or expose it publicly
- **ONLY** use it in server-side API routes (`/src/app/api/*`)
- **Store it only in `.env.local`** which is always in `.gitignore`
- **If compromised**, rotate it immediately in the Supabase dashboard — an attacker gains full read/write/delete access to all user data

DevTrack uses this key only in server-side API routes. See `.env.example` for detailed security requirements.

### 🔒 Database Security: Row Level Security (RLS) & Verification

All 32 application tables have RLS enabled. NextAuth sessions do not produce Supabase user JWTs, so browser roles have no direct table grants. Authenticated server APIs enforce ownership before the server service-role client accesses records. Realtime views use authenticated polling.

For an existing deployment, follow the [database adoption guide](supabase/README.md), including staging validation and migration-history reconciliation. Historical SQL under `supabase/legacy-migrations` is archival. New installations use the baseline (`supabase/schema.sql`, identical to the first migration) followed by every later migration in `supabase/migrations/`, in version order.

---

## 3. Create a GitHub OAuth App

1. Go to [github.com/settings/applications/new](https://github.com/settings/applications/new)
2. Fill in:
   - **Application name:** `DevTrack (local)`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
3. Click **Register application**
4. Copy **Client ID** → `GITHUB_ID`
5. Click **Generate a new client secret** → copy it → `GITHUB_SECRET`

---

## 4. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# GitHub OAuth
GITHUB_ID=Ov23...
GITHUB_SECRET=your_github_client_secret

# Encryption key — required for OAuth token encryption
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your_64_hex_char_key

# Cron secret — required for scheduled cron endpoints
# Generate with: openssl rand -hex 32
CRON_SECRET=your_cron_secret

# Contact form email delivery (optional)
RESEND_API_KEY=re_xxx...
RESEND_FROM_EMAIL="DevTrack <contact@your-domain.com>"
CONTACT_TO_EMAIL=you@example.com

# AI features (optional)
GROQ_API_KEY=your_groq_api_key
# ANTHROPIC_API_KEY=sk-ant-...

# Upstash Redis caching (optional)
# UPSTASH_REDIS_REST_URL=your_upstash_url
# UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

Generate `NEXTAUTH_SECRET` and `ENCRYPTION_KEY`:

```bash
# macOS / Linux
openssl rand -base64 32   # for NEXTAUTH_SECRET
openssl rand -hex 32      # for ENCRYPTION_KEY and CRON_SECRET

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
-join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
```

---

## 5. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Click **Sign in with GitHub**.

---

## Project Structure

A map of the places you'll touch most. For how they fit together, see [ARCHITECTURE.md](./ARCHITECTURE.md); for every API route, the Swagger UI at `/api-docs`.

```
src/
├── app/
│   ├── page.tsx                 # Arcade landing page
│   ├── dashboard/               # Signed-in app: HQ, activity, pull-requests, repositories,
│   │                            # goals, community, friends, rooms, AI tools, settings
│   ├── leaderboard/             # Public leaderboard
│   ├── compare/                 # Duels (/compare and /compare/<a>-vs-<b>)
│   ├── u/[username]/            # Player cards, share image, RSS feed
│   ├── top/                     # Top developers by language and country
│   ├── wrapped/                 # Year in Code
│   ├── guides/                  # Guides (content in src/content/guides.tsx)
│   ├── api/                     # Route handlers (metrics, badges, cron, auth, AI...)
│   └── sitemap.ts, robots.ts
├── components/
│   ├── dashboard/widgets.tsx    # Widget registry used by the dashboard pages
│   ├── landing/arcade/          # Landing sections
│   ├── buddy/                   # Bit the mascot and the pixel loading screen
│   ├── pixel/                   # Pixel-art icons
│   ├── shell/                   # Dashboard shell, menu (nav.ts), PageHeader
│   └── ui/arcade.ts             # Arcade tab helpers
├── content/                     # Guide content
├── lib/
│   ├── gamification/            # Score, tiers, XP, ranks, badges, share cards
│   ├── leaderboard.ts           # Leaderboard build and caching
│   ├── guest-profile.ts         # Player cards for any GitHub user
│   └── buddy-lines.ts           # What Bit says on each page
├── proxy.ts                     # CSP nonce, rate limits, CSRF, canonical-domain redirect
└── types/
messages/                        # UI translations (en, es)
supabase/
├── schema.sql                   # Baseline schema (identical to the first migration)
└── migrations/                  # Baseline + later migrations, applied in order
```

### How data flows

```
Browser → Next.js API route → GitHub API (with user's OAuth token)
                           → Supabase (for goals, user records, rooms)
                           → Groq/Anthropic (for AI features, optional)
```

All GitHub API calls use the signed-in user's OAuth token — stored in the session via NextAuth. No shared API key is required (though `GITHUB_TOKEN` can be set to raise rate limits for unauthenticated endpoints).

---

## Available scripts

| Command                        | What it does                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `pnpm dev`                     | Start the dev server at localhost:3000                                                |
| `pnpm dev:demo`                | Dev server on built-in sample data, no accounts needed                                |
| `pnpm build`                   | Validate env, then production build                                                   |
| `pnpm start`                   | Start the production server                                                           |
| `pnpm lint`                    | ESLint                                                                                |
| `pnpm type-check`              | TypeScript check (no emit)                                                            |
| `pnpm test`                    | Unit tests with Vitest                                                                |
| `pnpm test:e2e`                | Playwright end-to-end tests                                                           |
| `pnpm api:generate`            | Regenerate `public/openapi.yaml` after adding or changing an API route (CI checks it) |
| `pnpm test:db`                 | Database checks against a disposable PostgreSQL                                       |
| `pnpm supabase:generate-types` | Regenerate Supabase types from the schema                                             |

Before pushing:

```bash
pnpm lint && pnpm type-check && pnpm test
```

---

## Adding a new dashboard widget

1. **Check it isn't already shown.** Each chart or stat should appear once; look through the dashboard pages first.
2. **Build the component** in `src/components/MyWidget.tsx` (`"use client"`), wrapped in `px-frame` with a `font-pixel` title, following the arcade design system in [CONTRIBUTING.md](./CONTRIBUTING.md).
3. **Add an API route** in `src/app/api/metrics/my-widget/route.ts` if it needs data, then run `pnpm api:generate`.
4. **Register it** in `src/components/dashboard/widgets.tsx` with `slot(id, title, render)`, which adds the error boundary, lazy loading and accessible region.
5. **Place it** on the right page in `src/app/dashboard/*/page.tsx`, under a `SectionTitle`.

Pattern for an API route:

```ts
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // fetch from the GitHub API using session.accessToken
  // fetch from Supabase using session.githubId
}
```

---

## Common errors

### `NEXTAUTH_SECRET` missing

```
[next-auth][error][NO_SECRET]
```

Add `NEXTAUTH_SECRET` to `.env.local`. Generate one with:

```bash
# macOS / Linux
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

### GitHub OAuth `error=github` Redirect Loop

**Symptom:** After clicking "Sign in with GitHub" and completing the GitHub flow, the browser redirects back to `/auth/signin?error=github` instead of the dashboard.

Work through this checklist in order:

#### 1. Missing or placeholder env vars (most common cause)

Open `.env.local` and confirm these four are set to real values (not `your_...` placeholders):

```env
GITHUB_ID=Ov23...            # from github.com/settings/developers
GITHUB_SECRET=ghp_...        # generated in the same OAuth App
NEXTAUTH_SECRET=<32-byte>    # run: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

Also required for the database upsert on sign-in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

If `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` are missing, the server log will print:

```
signIn: supabaseAdmin is not configured; skipping DB upsert.
```

Authentication will still succeed, but no user record will be written to Supabase.

#### 2. Callback URL mismatch in the GitHub OAuth App

The **Authorization callback URL** in your GitHub OAuth App must be **exactly**:

```
http://localhost:3000/api/auth/callback/github
```

Any trailing slash, different port, or HTTPS vs HTTP mismatch will cause `error=github`. Verify at [github.com/settings/developers](https://github.com/settings/developers) → your OAuth App → **Authorization callback URL**.

#### 3. `ENCRYPTION_KEY` not set

The `ENCRYPTION_KEY` is required for OAuth token encryption:

```env
ENCRYPTION_KEY=<64 hex chars>   # run: openssl rand -hex 32
```

On Windows PowerShell:

```powershell
-join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Maximum 256) })
```

#### 4. Restart the dev server after changing env vars

Next.js reads `.env.local` only at startup. After any change, stop and restart:

```bash
npm run dev
```

#### 5. Check the server console for the real error

The browser only shows `error=github` — the actual error is printed to the **terminal running `npm run dev`**. Look for lines starting with `[next-auth]` or `signIn:`.

---

### GitHub OAuth callback URL mismatch

```
The redirect_uri is not associated with this application
```

Ensure the **Authorization callback URL** in your GitHub OAuth App is exactly:
`http://localhost:3000/api/auth/callback/github`

---

### Supabase "relation does not exist"

```
relation "users" does not exist
```

You forgot to run `supabase/schema.sql`. Go to Supabase SQL Editor and run it.

---

### GitHub API rate limit

```
{ "message": "API rate limit exceeded" }
```

You hit the 30 requests/minute search API limit. Wait 1 minute. In production this won't happen for normal usage.

---

## Schema synchronization (important)

When you add a new Supabase migration under `supabase/migrations/`, you must also update `supabase/schema.sql` so that fresh local setups work without manually running every migration.

Use a unique 14-digit migration version after `20261011000000`, update `supabase/schema.sql` (including new columns, tables, indexes, functions, and RLS/grants), and run `pnpm run test:db` and regenerate types. Do not append historical migrations from the archive.

---

## Troubleshooting

### 1. Invalid or missing `NEXT_PUBLIC_SUPABASE_URL`

- **Symptom:** Network requests to Supabase fail, or the application throws an error like `Invalid URL` during client initialization.
- **Likely Cause:** The `NEXT_PUBLIC_SUPABASE_URL` environment variable is not defined in `.env.local` or contains an invalid URL.
- **Solution:** Confirm your `.env.local` file contains `NEXT_PUBLIC_SUPABASE_URL` set to your Supabase project's API URL (e.g., `https://xyz.supabase.co`). You can retrieve this under **Project Settings > API** in the Supabase Dashboard.

### 2. Incorrect `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

- **Symptom:** API requests return `401 Unauthorized` or `403 Forbidden` errors, or the database fails to update upon user sign-in with `signIn: supabaseAdmin is not configured` logged to the console.
- **Likely Cause:** The anon public key or service role secret key is missing, truncated, or set to placeholder values in `.env.local`.
- **Solution:** Navigate to **Project Settings > API** in the Supabase Dashboard. Copy the `anon` (public) key and the `service_role` (secret) key, and paste them exactly as `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### 3. Supabase migrations not applied or missing tables

- **Symptom:** Server console logs show database relation errors (e.g., `relation "users" does not exist`) or client features fail to display data.
- **Likely Cause:** The required database schema tables and relationships have not been created on the Supabase database.
- **Solution:** Go to the Supabase **SQL Editor**, click **New Query**, paste the contents of `supabase/schema.sql`, and click **Run** to execute the script and initialize all required database objects.

### 4. GitHub OAuth callback URL misconfiguration

- **Symptom:** After initiating GitHub sign-in, the browser gets stuck in a redirect loop, returns to `/auth/signin?error=github`, or displays a redirect URI mismatch error.
- **Likely Cause:** The **Authorization callback URL** in your GitHub developer settings does not match the URL configured locally.
- **Solution:** Visit your GitHub account settings, go to **Developer Settings > OAuth Apps**, open your registered application, and verify that the **Authorization callback URL** matches `http://localhost:3000/api/auth/callback/github` exactly.

> **Note:** If you are deploying to a platform like Vercel, also add your production callback URL (e.g., `https://your-app.vercel.app/api/auth/callback/github`) in the same GitHub OAuth App settings. GitHub allows multiple callback URLs.

### 5. `NEXTAUTH_SECRET` not set or invalid

- **Symptom:** NextAuth throws a `[next-auth][error][NO_SECRET]` error in the terminal, and users cannot log in.
- **Likely Cause:** The `NEXTAUTH_SECRET` key is missing from `.env.local` or is empty.
- **Solution:** Generate a random 32-byte secret and add it to `.env.local` as `NEXTAUTH_SECRET`. You can generate it by running:
  ```bash
  # macOS / Linux
  openssl rand -base64 32

  # Windows PowerShell
  [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

  # Cross-platform (Node.js)
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

### 6. Environment variables not loading correctly from `.env.local`

- **Symptom:** Changes to environment variables in `.env.local` are not recognized, or values behave as if they are missing or outdated.
- **Likely Cause:** The Next.js development server has not been restarted since the environment variables were modified.
- **Solution:** Stop the active development server using `Ctrl + C` and start it again using `npm run dev`. Ensure the file is named exactly `.env.local` (not `.env` or `.env.local.txt`) and is in the project root.

> **Note:** Only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Server-only variables like `SUPABASE_SERVICE_ROLE_KEY` must never use this prefix — they should only be accessed in server-side code (API routes, server components). If a client-side feature is not working despite the variable being set, check that it has the `NEXT_PUBLIC_` prefix.

### 7. Port conflicts while running the development server

- **Symptom:** Starting the server fails with an `EADDRINUSE: address already in use :::3000` error, or the app is served on a fallback port like `3001`.
- **Likely Cause:** Another server or process is already listening on port `3000`.
- **Solution:** Free up port `3000` or run the dev server on a custom port.
  - To run on a custom port, execute: `npm run dev -- -p 3001`
  - To kill the existing process on Windows (PowerShell):
    ```powershell
    Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
    ```
  - To kill the existing process on macOS/Linux:
    ```bash
    # Option 1 (no extra packages required)
    lsof -ti:3000 | xargs kill -9

    # Option 2
    npx kill-port 3000
    ```

### 8. Basic steps to verify that the local setup is configured correctly

- **Symptom:** Need to confirm that your local environment, database schema, and OAuth are completely and correctly integrated.
- **Likely Cause:** Verifying the initial setup configuration.
- **Solution:**
  1. **Run Dev Server:** Start the server with `npm run dev` and ensure there are no startup errors in the console.
  2. **Page Load:** Open `http://localhost:3000` in your browser and verify the landing page displays correctly.
  3. **Sign In Check:** Click **Sign in with GitHub**, authorize the application, and verify that you are successfully redirected to the dashboard (`http://localhost:3000/dashboard`).
  4. **Database Check:** In the Supabase Dashboard, go to **Table Editor** and confirm that the `users` table exists and is populated after sign-in. If it is empty, re-check that `SUPABASE_SERVICE_ROLE_KEY` is correctly set and the schema migration has been applied.
  5. **Lint and Type-Check:** Run `npm run lint && npm run type-check` in your terminal and verify both commands pass without errors.

### 9. Node.js version incompatibility

- **Symptom:** `npm install` throws errors like `engine "node" is incompatible with this module`, unexpected syntax errors during `npm run dev`, or certain packages fail to compile.
- **Likely Cause:** Your system's Node.js version is below the required `>= 22.12 < 23`. Run `node -v` to check your current version.
- **Solution:** Install a supported Node.js 22 release and the pinned pnpm 11.13.1.
  - **Using nvm (recommended for macOS/Linux):**
    ```bash
    nvm install 22
    nvm use 22
    node -v   # should print v20.x.x or higher
    ```
  - **Using nvm-windows (Windows):**
    ```powershell
    nvm install 22
    nvm use 22
    node -v
    ```
  - **Without nvm:** Download the LTS installer directly from [nodejs.org](https://nodejs.org) and re-run `npm install` after upgrading.

### 10. npm version too old

- **Symptom:** `npm install` fails with peer dependency errors, lockfile conflicts, or warnings like `npm WARN old lockfile`. Some `npm run` scripts may not work as expected.
- **Likely Cause:** Your npm version is below the required `>= 10`. Run `npm -v` to check.
- **Solution:** Upgrade npm without changing your Node.js installation:
  ```bash
  # macOS / Linux
  npm install -g npm@latest

  # Windows PowerShell (run as Administrator)
  npm install -g npm@latest
  ```
  After upgrading, verify with `npm -v` and re-run `npm install` in the project directory.

### 11. TypeScript and build errors

- **Symptom:** `npm run build` or `npm run type-check` fails with TypeScript compiler errors. Common messages include `Type 'X' is not assignable to type 'Y'`, `Property 'X' does not exist on type 'Y'`, or `Cannot find module`.
- **Likely Cause:** Type errors in the source code, a missing or outdated dependency, or a mismatch between a library's types and its runtime version.
- **Solution:** Work through the following steps in order:
  1. **Run type-check to see all errors at once:**
     ```bash
     npm run type-check
     ```
  2. **Ensure dependencies are fully installed:**
     ```bash
     npm install
     ```
  3. **If the error mentions a missing module or type declaration**, install the relevant `@types` package:
     ```bash
     npm install --save-dev @types/<package-name>
     ```
  4. **Clear the Next.js build cache** and retry:
     ```bash
     # macOS / Linux
     rm -rf .next

     # Windows PowerShell
     Remove-Item -Recurse -Force .next

     npm run build
     ```
  5. **Fix the reported errors** in your source files. If you are unsure about a type, avoid using `any` — check the library's documentation or existing usages in the codebase for the correct type.
  6. **Run lint alongside type-check** before pushing to catch all issues:
     ```bash
     npm run lint && npm run type-check
     ```

---

## Questions?

Open a [GitHub Discussion](https://github.com/Priyanshu-byte-coder/devtrack/discussions) — not an issue.

### Husky Hooks Troubleshooting Guide

- If prettier-check fails in sandboxed environments, run git commit with --no-verify.
