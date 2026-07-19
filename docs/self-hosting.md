# DevTrack Self-Hosting Guide

DevTrack is designed to be easily self-hostable. Since it uses Next.js and Supabase, you can deploy the web app anywhere Node.js or Docker runs, and you can point it to a free Supabase cloud database.

Choose your preferred deployment method below:

- [Method 1: Docker (Recommended)](#1-docker-recommended)
- [Method 2: Railway](#2-railway)
- [Method 3: Render](#3-render)

---

## 🔑 Prerequisites & Environment Variables

Before deploying, you need to set up two external services: **Supabase** (Database) and **GitHub** (Authentication).

### 1. Database Setup (Supabase)
DevTrack uses `@supabase/supabase-js` which relies on the Supabase REST API, so a standard raw PostgreSQL container won't work out of the box. The easiest path is to use Supabase Cloud:
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor -> New Query**, paste the contents of `supabase/schema.sql` from this repository, and run it.
3. Go to **Project Settings -> API** to get your URL and Keys.

### 2. GitHub OAuth App Setup
1. Go to [GitHub Developer Settings -> OAuth Apps](https://github.com/settings/applications/new).
2. Set the **Homepage URL** to your deployment URL (e.g., `https://devtrack.my-domain.com`).
3. Set the **Authorization callback URL** to `<YOUR_URL>/api/auth/callback/github`.
4. Generate a new Client Secret and save both the Client ID and Client Secret.

### Environment Variables Reference

| Variable | Required? | Description | Example |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase `anon` public key | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase `service_role` secret key — **never expose client-side** | `eyJhbG...` |
| `NEXTAUTH_URL` | Yes | The canonical URL of your deployed app, no trailing slash | `https://devtrack.my-domain.com` |
| `NEXTAUTH_SECRET` | Yes | Random 32-byte base64 string | Run `openssl rand -base64 32` |
| `GITHUB_ID` | Yes | GitHub OAuth Client ID | `Ov23...` |
| `GITHUB_SECRET` | Yes | GitHub OAuth Client Secret | `458e...` |
| `ENCRYPTION_KEY` | Yes | 64 hex chars (32 bytes) for AES-256-GCM OAuth token encryption | Run `openssl rand -hex 32` |
| `CRON_SECRET` | Yes | Bearer token for `/api/cron/*` endpoints — required in all environments | Run `openssl rand -hex 32` |
| `GITHUB_TOKEN` | Optional | GitHub Personal Access Token (increases API rate limits) | `ghp_...` |
| `GITHUB_WEBHOOK_SECRET` | Optional | HMAC secret for verifying GitHub push webhook payloads | Run `openssl rand -hex 32` |
| `RESEND_API_KEY` | Optional | Resend API key for contact form and weekly digest emails | `re_...` |
| `RESEND_FROM_EMAIL` | Optional | From address for outbound emails | `DevTrack <noreply@example.com>` |
| `CONTACT_TO_EMAIL` | Optional | Delivery address for contact form submissions | `you@example.com` |
| `GROQ_API_KEY` | Optional | Groq API key for AI features (project tutor, personality report, roast) | `gsk_...` |
| `ANTHROPIC_API_KEY` | Optional | Anthropic API key for AI weekly summary generation | `sk-ant-...` |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST URL for distributed metrics caching | `https://...upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis REST token | `AXxx...` |
| `LEADERBOARD_REBUILD_TOKEN` | Optional | Auth token for the `/api/leaderboard/rebuild` endpoint | Run `openssl rand -hex 32` |
| `LEADERBOARD_USER_CONCURRENCY` | Optional | Concurrent user fetches during leaderboard builds (default: `5`) | `5` |
| `WAKATIME_CLIENT_ID` | Optional | WakaTime OAuth Client ID (for WakaTime integration) | `waka_...` |
| `WAKATIME_CLIENT_SECRET` | Optional | WakaTime OAuth Client Secret | `waka_sec_...` |
| `ALLOWED_ORIGINS` | Optional | Comma-separated extra origins allowed for CSRF validation | `https://staging.example.com` |

---

## 1. Docker (Recommended)

DevTrack provides a production-ready `Dockerfile` and `docker-compose.yml`.

### Docker Variables Reference Manual

When running DevTrack with Docker, set the following environment variables in your `.env` file or container configuration.

| Variable | Required? | Docker / Self-Hosting Notes |
|---|---|---|
| `NODE_ENV` | Yes | Must be set to `production` for self-hosted containers. |
| `PORT` | Yes | Port exposed by the app inside the container. Default: `3000`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase Project URL used by the frontend. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public Supabase anonymous key used by the frontend. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase key required for secure API access. |
| `NEXTAUTH_URL` | Yes | Public URL of your deployed Docker instance. |
| `NEXTAUTH_SECRET` | Yes | Secret used by NextAuth for signing sessions. |
| `GITHUB_ID` | Yes | GitHub OAuth App Client ID. |
| `GITHUB_SECRET` | Yes | GitHub OAuth App Client Secret. |
| `ENCRYPTION_KEY` | Yes | 64 hex chars — used to encrypt GitHub tokens for linked accounts. |
| `CRON_SECRET` | Yes | Bearer secret for scheduled cron endpoints. |
| `GITHUB_TOKEN` | Optional | Optional PAT to reduce GitHub API rate-limit issues. |

#### Docker setup steps
1. Clone the repository and navigate into it:
   ```bash
   git clone https://github.com/Umbrella-io/devtrack.git
   cd devtrack
   ```
2. Copy the `.env.example` file to `.env` and fill in the required variables.
   ```bash
   cp .env.example .env
   ```
3. Ensure `NODE_ENV=production` is set in your container or compose configuration.
4. Start the container:
   ```bash
   docker compose up -d
   ```
5. DevTrack will be available at `http://localhost:3000`.

---

## 2. Railway

Railway is a modern PaaS that can deploy DevTrack directly from a GitHub repository.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2FUmbrella-io%2Fdevtrack)

### Manual Setup
1. Click **New Project -> Deploy from GitHub repo** and select your fork of DevTrack.
2. Railway will detect the Node.js environment automatically.
3. Go to the **Variables** tab and add all the required Environment Variables from the table above.
4. Click **Deploy**.
5. Once deployed, go to the **Settings** tab and generate a custom domain to get your `NEXTAUTH_URL`. Don't forget to update your GitHub OAuth app's callback URL to match!

---

## 3. Render

DevTrack includes a `render.yaml` Blueprint for easy deployment on Render's free tier.

1. Create a free account on [Render](https://render.com/).
2. In the Render Dashboard, click **New + -> Blueprint**.
3. Connect your GitHub account and select your fork of DevTrack.
4. Render will automatically detect the `render.yaml` configuration and prompt you to fill in the required environment variables.
   *Note: `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` will be automatically generated for you.*
5. Click **Apply**. Render will build and deploy your app.
6. Once live, update your `NEXTAUTH_URL` environment variable to match your Render `.onrender.com` domain, and update your GitHub OAuth settings accordingly.

---

## 🔧 Troubleshooting

- **Server Error 500 on Login**:
  Make sure your `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` are set. If `ENCRYPTION_KEY` is missing or the wrong length (must be 32 bytes / 64 hex chars), the OAuth callback will crash when attempting to encrypt the GitHub token.
- **Login Redirects back to Home Page infinitely**:
  Ensure your `NEXTAUTH_URL` exactly matches your deployment URL (including `https://` and no trailing slash).
- **Database Fetch Errors**:
  Make sure you ran the `supabase/schema.sql` file in your Supabase SQL editor. Without the `users` and `goals` tables, the dashboard will fail to load.
- **Cron endpoints return 401**:
  Ensure `CRON_SECRET` is set in your environment. Cron routes require a `Authorization: Bearer <CRON_SECRET>` header and fail closed when the secret is absent.
- **AI features not available**:
  AI routes (personality, project tutor, roast, weekly summary) require `GROQ_API_KEY` or `ANTHROPIC_API_KEY`. Without them, AI buttons are hidden or the endpoints return a graceful error. The rest of the app functions normally.
- **Leaderboard rebuild endpoint returns 401**:
  Set `LEADERBOARD_REBUILD_TOKEN` in your environment and pass it as `Authorization: Bearer <token>` when calling `/api/leaderboard/rebuild`.
