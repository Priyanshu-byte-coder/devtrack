# Contributing to DevTrack

Thank you for your interest in contributing to DevTrack! Whether you are a GSSoC (GirlScript Summer of Code) participant or a general open-source contributor, we are thrilled to have you.

Please note that this project is released with a Code of Conduct. By participating in this project, you agree to abide by its terms.

---

## ⚡ Quick Start (Setup in < 10 Steps)

### 1. Fork the Repository

Click the **Fork** button at the top-right of the DevTrack repository.

### 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/devtrack.git
cd devtrack
```

### 3. Configure Upstream Remote

```bash
git remote add upstream https://github.com/Umbrella-io/devtrack.git
```

### 4. Install pnpm

We use **pnpm** for this project. If you don't have it installed:

```bash
npm install -g pnpm
```

### 5. Install Dependencies

```bash
pnpm install
```

### 6. Set Up Environment Variables

Copy the template file:

```bash
cp .env.example .env.local
```

### 7. Configure Keys

Open `.env.local` in your editor and add your development keys (see Environment Variables Guide below).

### 8. Start the Development Server

```bash
pnpm dev
```

### 9. Open the App

Navigate to:

```text
http://localhost:3000
```

---

## 📋 Table of Contents

- Prerequisites
- Local Development Setup
- Verifying Your Setup
- Environment Variables Guide
- Troubleshooting Common Issues
- Code Style & Standards
- Branch Naming Conventions
- Commit Guidelines
- Issue Labels & GSSoC Levels
- Pull Request (PR) Checklist
- Self-Hosting & Deployment

---

## Prerequisites

Before setting up DevTrack locally, make sure you have configured the following:

### Node.js

- Version **20 or higher** is required.

### pnpm

- Version **9 or higher** is required.

### GitHub OAuth App

1. Go to:

   ```
   GitHub Profile → Settings → Developer Settings → OAuth Apps → New OAuth App

1. **Fork the Repo:** Click the "Fork" button at the top-right of the [DevTrack repository](https://github.com/Umbrella-io/devtrack).
2. **Clone Your Fork:**
   ```bash
   git clone https://github.com/<your-username>/devtrack.git
   cd devtrack
   ```
3. **Configure Upstream Remote:**
   ```bash
   git remote add upstream https://github.com/Umbrella-io/devtrack.git
   ```

2. Configure:

   **Application Name**

   ```
   DevTrack Dev
   ```

   **Homepage URL**

   ```
   http://localhost:3000
   ```

   **Authorization Callback URL**

   ```
   http://localhost:3000/api/auth/callback/github
   ```

3. Register the application.

4. Copy the **Client ID** and generate a new **Client Secret**.

---

## Local Development Setup

To get a fully functional copy running with authentication and metrics:

### Database Setup (Supabase)

1. Create a free project on Supabase.
2. Retrieve your:
   - Project API URL
   - Anon Key
   - Service Role Key

From:

```
Project Settings → API
```

### Environment Variables

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Environment Variables Guide](#3-environment-variables-guide)
4. [Code Style & Standards](#4-code-style--standards)
5. [Branch Naming Conventions](#5-branch-naming-conventions)
6. [Commit Guidelines](#6-commit-guidelines)
7. [Issue Labels & GSSoC Levels](#7-issue-labels--gssoc-levels)
8. [Pull Request (PR) Checklist](#8-pull-request-pr-checklist)
9. [Self-Hosting & Deployment](#9-self-hosting--deployment)
10. [Frequently Asked Questions (FAQ)](#10-frequently-asked-questions-faq)

---

## ✅ Verifying Your Setup

After completing the steps above, run these checks to confirm everything is working:

```bash
# 1. Check if the dev server is running
curl http://localhost:3000

# 2. Check your environment variables
pnpm run check-env

# 3. Run TypeScript type checking
pnpm run type-check

# 4. Run tests
pnpm run test

# 5. Build the production version
pnpm run build
```

### Browser Verification

1. Go to:

   ```
   http://localhost:3000
   ```

2. Click **Sign in with GitHub**.

3. Complete the GitHub authentication flow.

4. Verify that your DevTrack dashboard loads successfully.

If all steps pass, your development environment is ready! 🎉

---

## Environment Variables Guide

DevTrack relies on a set of environment variables to connect to external APIs and database services.

Copy `.env.example` to `.env.local` and populate the following values:

| Variable | Required | Description |
|-----------|-----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Your Supabase public anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase secret key |
| `NEXTAUTH_URL` | Yes | Base URL where your app runs locally |
| `NEXTAUTH_SECRET` | Yes | Used to sign NextAuth tokens |
| `GITHUB_ID` | Yes | GitHub OAuth Client ID |
| `GITHUB_SECRET` | Yes | GitHub OAuth Client Secret |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key used to encrypt OAuth tokens |
| `GITHUB_WEBHOOK_SECRET` | No | Secret key to verify incoming GitHub webhooks |
| `GITHUB_TOKEN` | No | GitHub PAT used to bypass API rate limits |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST Token |
| `GROQ_API_KEY` | No | Groq API Key for AI insights |

### Generate Secrets

For `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

For `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

## Troubleshooting Common Issues

Here are solutions to the most frequent problems contributors face during setup.

---

### Issue: `pnpm install` fails with permission errors

#### Solution

**macOS/Linux**

Fix npm permissions (recommended) instead of using `sudo`:

```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

⚠️ Only use `sudo` as a last resort, as it can cause persistent permission issues.

**Windows**

Run your terminal as Administrator.

---

### Issue: `.env.local` file not found or missing variables

#### Solution

**macOS/Linux (or Git Bash)**

```bash
cp .env.example .env.local
```

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

Then open `.env.local` in your editor and fill in all required values (see Environment Variables Guide above).

---

### Issue: Supabase connection error

#### Solution

- Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct.
- Check if your Supabase project is active (not paused due to inactivity).
- Ensure Row Level Security (RLS) policies are properly configured for your tables.
- Check that your IP is not blocked by the Supabase firewall.

---

### Issue: GitHub OAuth returns "redirect_uri mismatch"

#### Solution

1. Go to your GitHub OAuth App settings.
2. Ensure the Authorization callback URL is exactly:

```text
http://localhost:3000/api/auth/callback/github
```

3. Make sure `NEXTAUTH_URL` in `.env.local` matches:

```text
http://localhost:3000
```

4. Do not include a trailing slash.
5. If using a different port, update both the callback URL and `NEXTAUTH_URL`.

---

### Issue: Port 3000 already in use

#### Solution

**macOS/Linux**

```bash
lsof -ti:3000 | xargs kill -9
```

**Windows**

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

Or run the application on a different port:

```bash
pnpm dev -- -p 3001
```

---

### Issue: TypeScript errors during build or type-check

#### Solution

Run:

```bash
pnpm run type-check
```

Fix the reported errors, then build again:

```bash
pnpm run build
```

**Common fixes:**

- Add missing types
- Fix import paths
- Update dependencies

---

### Issue: Dependency conflicts after pulling latest changes

#### Solution

**macOS/Linux (or Git Bash)**

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Windows PowerShell**

```powershell
Remove-Item -Recurse -Force node_modules, pnpm-lock.yaml
pnpm install
```

---

### Issue: The app loads but metrics/data are missing

#### Solution

- Open browser developer tools (`F12`) and check the Console for API errors.
- Verify your GitHub token (`GITHUB_TOKEN`) has the required permissions (`repo`, `read:user`, etc.).
- Ensure Supabase tables are properly seeded with test data.
- Check that the API routes are correctly configured in `pages/api/` or `app/api/`.

---

### Issue: `NEXTAUTH_SECRET` or `ENCRYPTION_KEY` not set

#### Solution

Generate secure keys using the terminal.

**For `NEXTAUTH_SECRET`**

```bash
openssl rand -base64 32
```

**For `ENCRYPTION_KEY`**

```bash
openssl rand -hex 32
```

Copy the generated values and paste them into your `.env.local` file.

---

### Issue: "Module not found" or "Cannot find module" errors

#### Solution

Ensure all dependencies are installed:

```bash
pnpm install
```

Check that you're running the command from the project root directory.

Try clearing the Next.js cache.

**macOS/Linux (or Git Bash)**

```bash
rm -rf .next
pnpm dev
```

**Windows PowerShell**

```powershell
Remove-Item -Recurse -Force .next
pnpm dev
```

---

## Code Style & Standards

To ensure code readability and maintainability, please adhere to our styling rules.

### Linting & Formatting

We use ESLint and Prettier.

```bash
pnpm run lint
```

### TypeScript Strict Mode

Write clean, strongly typed code.

```bash
pnpm run type-check
```

### Clean Code Guidelines

- Remove all unused imports and variables.
- Delete debugging statements such as `console.log`.
- Remove temporary comments.
- Ensure proper semantic HTML.
- Follow accessibility (a11y) standards.

---

## Branch Naming Conventions

Always create a new branch for your task.

❌ Never push directly to `main`.

### Format

```text
prefix/short-descriptive-name
```

### Prefix Types

| Prefix | Example |
|----------|----------|
| `feat/` | `feat/add-achievements-tab` |
| `fix/` | `fix/oauth-token-expiry` |
| `docs/` | `docs/update-installation-guide` |
| `test/` | `test/visual-regression-setup` |
| `refactor/` | `refactor/api-routes` |

---

## Commit Guidelines

We enforce Conventional Commits to keep our git history clean and understandable.

### Format

```text
type(scope): short, imperative description
```

### Types

- `feat` – New feature
- `fix` – Bug fix
- `docs` – Documentation updates
- `style` – Formatting or styling changes
- `refactor` – Code restructuring
- `test` – Adding or correcting tests
- `chore` – Maintenance tasks

### Examples

```text
feat(auth): integrate github oauth authentication

fix(dashboard): resolve chart container responsive scaling

docs(contributing): document environment variable configuration
```

---

## Issue Labels & GSSoC Levels

For contributors joining through GirlScript Summer of Code (GSSoC), we map issues using levels to indicate complexity and points.

| Label | Level / Difficulty | Points |
|---------|-------------------|---------|
| `gssoc:level1` | Beginner — Simple styling, documentation fixes, minor bugs | 20 |
| `gssoc:level2` | Intermediate — Feature additions, routing changes, basic tests | 35 |
| `gssoc:level3` | Advanced — Complex logic, API integrations, deep layout refactoring | 55 |

### Guidelines

### Guidelines:
* **One Issue at a Time**: Prefer working on one issue at a time so reviews stay focused.
* **Auto-unassignment**: If you are assigned but do not open a PR within **7 days**, the issue-assignment bot will unassign you so others can pick it up. Still working on it? Comment on the issue and request re-assignment.
* **Link Issue to PR**: Ensure your pull request description explicitly links to your assigned issue (e.g. `Closes #45`).
* **GSSoC scoring labels**: Maintainers apply `level:*` difficulty labels and `gssoc:approved` on your PR at merge time so it counts toward GSSoC scoring. See [FAQ — GSSoC 2026](#gssoc-2026) for details.

---

## Pull Request (PR) Checklist

Before submitting your PR, verify the following.

### Lockfile Consistency

- Use only `pnpm`
- Do not commit unnecessary `package-lock.json` changes
- Ensure `pnpm-lock.yaml` is clean

### Tests Pass

```bash
pnpm run test
```

### Application Builds Successfully

```bash
pnpm run build
```

### Additional Checks

- No console warnings or errors
- UI changes include screenshots or GIFs
- Commits follow conventional commit standards
- PR description clearly explains the changes

---

## Self-Hosting & Deployment

For guides on self-hosting DevTrack or deploying it manually, please refer to the Self-Hosting Documentation.

---

# 🚀 Thank You!

Thank you for helping make **DevTrack** better!

Happy coding! 🚀

---

## 10. Frequently Asked Questions (FAQ)

Answers to the most common questions from new contributors and GSSoC participants. If your question is not covered here, ask in [GitHub Discussions](https://github.com/Priyanshu-byte-coder/devtrack/discussions) or on the GSSoC Discord.

### Getting Started

<details>
<summary><strong>Do I need to be assigned to an issue before I start coding?</strong></summary>

Yes. Comment on the issue you want to work on and wait for the assignment bot to confirm. The bot assigns you when your comment includes phrases such as:

- `I'd like to work on this`
- `assign me`
- `I can work on this`

Do not open a PR for an issue that is already assigned to someone else.
</details>

<details>
<summary><strong>Can I work on multiple issues at the same time?</strong></summary>

Prefer one issue at a time so reviews stay manageable. The per-contributor assignment limit is temporarily disabled, but maintainers may still ask you to finish an in-progress issue before picking up another.
</details>

<details>
<summary><strong>Should I use npm or pnpm?</strong></summary>

CI runs `npm ci` against `package-lock.json`, and [DEVELOPMENT.md](./DEVELOPMENT.md) uses `npm` commands. For the closest match with CI, use **npm**:

```bash
npm install
npm run dev
```

Some sections of this guide reference `pnpm`; either package manager works locally, but **do not commit conflicting lockfile changes**. Do not mix `package-lock.json` and `pnpm-lock.yaml` updates in the same PR.
</details>

<details>
<summary><strong>Which environment variables are required?</strong></summary>

At minimum you need Supabase credentials, NextAuth settings, GitHub OAuth keys, and `ENCRYPTION_KEY` to sign in and load the dashboard. See the full table in [Section 3 — Environment Variables Guide](#3-environment-variables-guide).

Optional variables (`GROQ_API_KEY`, Upstash Redis, `GITHUB_TOKEN`, etc.) enable extra features but are not required for basic local development.
</details>

<details>
<summary><strong>Where is the full local setup guide?</strong></summary>

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — step-by-step setup from clone to running app
- **[docs/architecture.md](./docs/architecture.md)** — how pages, API routes, and Supabase fit together
- **[docs/self-hosting.md](./docs/self-hosting.md)** — deployment and production env vars
</details>

<details>
<summary><strong>I'm new to open source — where should I start?</strong></summary>

Browse [good first issues](https://github.com/Priyanshu-byte-coder/devtrack/issues?q=label%3A%22good+first+issue%22), read [docs/architecture.md](./docs/architecture.md), and pick a `gssoc:level1` or documentation issue if you are participating in GSSoC.
</details>

### Issues and PRs

<details>
<summary><strong>How do I claim an issue?</strong></summary>

1. Find an open, unassigned issue.
2. Comment with your intent (e.g. `I'd like to work on this issue. I'm a GSSoC'26 contributor.`).
3. Wait for the bot to assign you and add the `gssoc:assigned` label.
4. Create a branch, implement the change, and open a PR linking the issue (`Closes #123`).
</details>

<details>
<summary><strong>How long do I have before I lose my assignment?</strong></summary>

You have **7 days** from assignment to open a PR. If no PR is linked within that window, the auto-unassign bot removes your assignment so another contributor can take the issue. If you need more time, comment on the issue before the deadline.
</details>

<details>
<summary><strong>Which branch should my PR target?</strong></summary>

Always open PRs against **`main`** on the upstream repository (`Priyanshu-byte-coder/devtrack`). Never push directly to `main` on upstream — work on a feature branch in your fork instead.
</details>

<details>
<summary><strong>Should I use <code>feat/</code> or <code>feature/</code> for branch names?</strong></summary>

Prefer the prefixes in [Section 5](#5-branch-naming-conventions): `feat/`, `fix/`, `docs/`, `test/`, `refactor/`. Example: `docs/contributing-faq`.
</details>

<details>
<summary><strong>What must my pull request include?</strong></summary>

- A clear title and description
- `Closes #<issue-number>` in the PR body
- Passing CI checks (lint, type-check, tests, build)
- Screenshots or a short GIF for UI changes
- Conventional commit messages on your branch
</details>

<details>
<summary><strong>How do I keep my fork up to date with upstream?</strong></summary>

```bash
git fetch upstream
git checkout main
git rebase upstream/main
git push origin main
```

Before opening or updating a PR, rebase your feature branch onto the latest `upstream/main`.
</details>

### GSSoC 2026

<details>
<summary><strong>How do GSSoC points work for DevTrack?</strong></summary>

Points depend on issue difficulty and PR quality labels applied by maintainers at merge time. The assignment bot and GSSoC label automation help track your work, but **maintainers must add `level:*` and `gssoc:approved` labels before your PR counts toward scoring**.
</details>

<details>
<summary><strong>What labels matter for GSSoC scoring?</strong></summary>

| Label | Purpose |
| :--- | :--- |
| `level:beginner` | 20 pts |
| `level:intermediate` | 35 pts |
| `level:advanced` | 55 pts |
| `level:critical` | 80 pts |
| `quality:clean` | ×1.2 multiplier (optional) |
| `quality:exceptional` | ×1.5 multiplier (optional) |
| `gssoc:approved` | **Required** for the PR to score |
| `gssoc:invalid` / `gssoc:spam` / `gssoc:ai-slop` | Does not score |

Issue labels such as `gssoc:level1` indicate estimated difficulty; final scoring labels are applied on the merged PR.
</details>

<details>
<summary><strong>Is documentation-only work valid for GSSoC?</strong></summary>

Yes. Documentation improvements are valuable contributions. Use a `docs/` branch prefix, and your PR will receive a `type:docs` label when merged.
</details>

<details>
<summary><strong>Should I mention GSSoC in my issue comment or PR?</strong></summary>

Yes — mention that you are a GSSoC'26 contributor when requesting assignment (e.g. `I'm a GSSoC'26 contributor and I would like to work on this issue.`). Always link the issue in your PR with `Closes #<number>`.
</details>

<details>
<summary><strong>What happens after my PR is approved?</strong></summary>

A maintainer merges your PR and applies the appropriate `level:*` and `gssoc:approved` labels. If those labels are missing after approval, the GSSoC bot will remind maintainers so your contribution counts.
</details>

### Troubleshooting

<details>
<summary><strong>My pre-commit or Husky hook failed — what do I do?</strong></summary>

DevTrack runs ESLint and formatting checks before commits. See **[docs/HUSKY_TROUBLESHOOTING.md](./docs/HUSKY_TROUBLESHOOTING.md)** for step-by-step fixes, including permission errors on Linux/macOS and Windows-specific issues.
</details>

<details>
<summary><strong>CI is failing on lint or type-check — how do I fix it locally?</strong></summary>

Run the same checks CI uses:

```bash
npm run lint
npm run type-check
npm run test
npm run build
```

Fix all reported errors before pushing again.
</details>

<details>
<summary><strong>GitHub OAuth login is not working locally — what should I check?</strong></summary>

Verify the following in [Section 1 — Prerequisites](#1-prerequisites):

- GitHub OAuth **callback URL** is exactly `http://localhost:3000/api/auth/callback/github`
- `NEXTAUTH_URL` is `http://localhost:3000`
- `GITHUB_ID` and `GITHUB_SECRET` match your OAuth app
- `.env.local` exists and the dev server was restarted after editing env vars
</details>

<details>
<summary><strong>Where can I ask for help if I'm stuck?</strong></summary>

- **[GitHub Discussions](https://github.com/Priyanshu-byte-coder/devtrack/discussions)** — questions, ideas, and community help
- **Comment on your assigned issue** — maintainers and other contributors can guide you
- **GSSoC Discord** — see [docs/HUSKY_TROUBLESHOOTING.md](./docs/HUSKY_TROUBLESHOOTING.md) for community links
- **[Open an issue](https://github.com/Priyanshu-byte-coder/devtrack/issues/new/choose)** — for bugs or unclear documentation
</details>

<details>
<summary><strong>My PR has merge conflicts — how do I resolve them?</strong></summary>

Sync with upstream and rebase your branch:

```bash
git fetch upstream
git rebase upstream/main
# resolve conflicts in your editor, then:
git add .
git rebase --continue
git push --force-with-lease origin your-branch-name
```

If you are unsure how to resolve a conflict, ask in your PR or issue before force-pushing.
</details>

---

Thank you for helping make DevTrack better! Happy coding! 🚀


### GSSoC Git Commit & Branching Conventions

To maintain a clean and consistent Git history, contributors must follow these standards.

## 🧾 Commit Message Convention

Use prefixes:

- feat: New feature
- fix: Bug fix
- chore: Maintenance tasks (deps, configs, lockfiles)
- docs: Documentation updates
- refactor: Code restructuring without behavior change
- test: Adding or updating tests

### Examples:
- feat(auth): add GitHub OAuth login
- fix(ui): resolve navbar alignment issue
- docs(contributing): update branching guide
- chore: update dependencies

---

## 🌿 Branch Naming Convention

- feature/<name>
- fix/<name>
- docs/<name>

### Examples:
- feature/login-system
- fix/header-alignment
- docs/readme-update

---

## 🔁 PR Guidelines

- Keep PRs small and focused
- One change per PR
- Link the issue

```text
Closes #1944
```

- Link issue: Closes #1944
- Ensure all checks pass before submitting

---

## 📌 Best Practices

- Write meaningful commit messages
- Do not mix unrelated changes
- Rebase before pushing if needed
- Rebase before push if needed

