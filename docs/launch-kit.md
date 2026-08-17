# DevTrack Launch Kit

Ready-to-post copy for external distribution. Post one channel per day — spreading them out
keeps each one fresh and lets you reuse momentum ("we hit the dev.to front page yesterday").

---

## 1. Hacker News — Show HN

**Title (pick one):**

- Show HN: DevTrack – open-source dashboard for your GitHub activity and streaks
- Show HN: I built a self-hostable GitHub analytics dashboard with 270 contributors

**First comment (post immediately after submitting — this is what people actually read):**

> Hi HN. DevTrack started as a weekend project to see my commit streaks and PR review
> times in one place, and grew into a community project with 270+ contributors and 800+
> merged PRs, many of them first-time open-source contributions.
>
> It pulls your GitHub activity into a dashboard: contribution heatmap with repo/language
> filters, PR analytics (review time, merge rate), streak tracking with freezes, goals that
> auto-sync from real activity, and some AI tools (resume generator from your actual GitHub
> history, weekly insights).
>
> Stack: Next.js 16, TypeScript, Supabase, deployable free on Vercel — one-click deploy in
> the README. Fully self-hostable, full data export, MIT.
>
> Live demo: https://devtrack-silk-kappa.vercel.app
> Repo: https://github.com/Priyanshu-byte-coder/devtrack
>
> Happy to answer anything about the build or about running a high-volume open-source
> project as a student maintainer.

**Rules that matter:** post 8-11am US Eastern on a weekday, never ask for upvotes or stars
in the post, reply to every comment fast for the first 3 hours.

---

## 2. Reddit

**r/opensource / r/selfhosted / r/coolgithubprojects (adapt per sub):**

Title: `DevTrack — open-source, self-hostable GitHub analytics dashboard (270+ contributors, MIT)`

> I maintain DevTrack, an MIT-licensed dashboard that turns your GitHub activity into
> something actually readable: contribution heatmap with filters, PR review-time analytics,
> commit streaks with freezes, coding goals that sync from real activity, plus an AI resume
> generator that builds a resume from your merge history instead of what you type into it.
>
> Runs entirely on free tiers (Vercel + Supabase), one-click deploy, full data export.
> It's been built by 270+ contributors — a lot of them made their first open-source PR here.
>
> Demo: https://devtrack-silk-kappa.vercel.app
> Code: https://github.com/Priyanshu-byte-coder/devtrack
>
> Feedback welcome — especially from self-hosters, the Docker path is newer.

**r/webdev — Showoff Saturday only.** Same body, lead with a screenshot.

---

## 3. dev.to article (long-form, evergreen)

**Title options:**

- What I learned merging 800+ PRs from 270 contributors as a student maintainer
- We built an open-source GitHub analytics dashboard — here's the architecture

The maintainer-story angle outperforms the product angle on dev.to. Outline:

1. Hook: the fork-to-star gap (430 forks, 169 stars) and what it taught you about OSS funnels
2. How GSSoC flooded the repo with PRs and how you triaged (labels, CI gates, AI-slop policy)
3. The code-quality freeze decision (link discussion #2651) — pausing features to pay debt
4. Architecture tour: Next.js App Router + Supabase RLS + rate limiting + metrics cache
5. Close: what you'd do differently, link demo + repo

---

## 4. LinkedIn / X post

> DevTrack just crossed 270 contributors and 800 merged pull requests.
>
> It's an open-source dashboard that turns your GitHub activity into insight: streaks,
> PR analytics, contribution heatmaps, goals, and an AI resume generator built from your
> actual commit history.
>
> Built with Next.js and Supabase. Self-hostable in one click. MIT licensed.
>
> Live demo and repo in the comments. If you've contributed — thank you. You built this.

(Repo link in first comment, not the post body — LinkedIn suppresses posts with links.)

---

## 5. Awesome-list submissions (durable, compounding)

Open PRs adding DevTrack to these lists (one line + link each, follow each list's
contributing rules — most require the project to be >30 days old with real activity, which
DevTrack easily clears):

| List                                            | Section                                            |
| ----------------------------------------------- | -------------------------------------------------- |
| `awesome-selfhosted/awesome-selfhosted`         | Software Development - Project Management          |
| `unicodeveloper/awesome-nextjs`                 | Apps / Open source                                 |
| `MunGell/awesome-for-beginners`                 | TypeScript (good-first-issue friendly repos)       |
| `sindresorhus/awesome` (via awesome-selfhosted) | —                                                  |
| alternativeto.net                               | Create listing (WakaTime / Codersrank alternative) |
| selfh.st + awesome-sysadmin                     | Self-hosted directory submissions                  |

`awesome-for-beginners` is the sleeper hit: it routes new contributors _and_ stargazers
directly to you, and DevTrack's curated good-first-issue label is exactly what it indexes.

---

## 6. The badge loop (your built-in viral channel)

DevTrack ships embeddable SVG badges (`/api/badge/streak-shield`, `/api/badge/commits`).
Every contributor who adds one to their GitHub profile README becomes a permanent backlink.

Do:

- Pin a Discussion titled "Add your DevTrack streak badge to your profile" with copy-paste
  markdown snippets.
- Add the snippet to the PR-merged bot comment ("show off the streak you just extended").

---

## 7. GSSoC channels

One message in the GSSoC Discord/community group reaches most of your 272 contributors at
once, off-GitHub, where a star ask is just a normal community ask:

> DevTrack update: we crossed 800 merged PRs. If DevTrack was part of your GSSoC journey,
> two asks — add your streak badge to your profile README, and star the repo so the next
> batch of contributors can find it. Both take 30 seconds.

---

## Do NOT do (these get repos flagged or communities hostile)

- Star-exchange rings / "star for star" — violates GitHub's inauthentic-activity policy;
  repos have been delisted for it
- Mass-@mentioning contributors in issues
- Emailing addresses scraped from commits
- Asking for upvotes on HN/Reddit (instant ban)
- Buying stars — trending algorithms detect the burst pattern and it poisons the repo's
  credibility permanently

---

## Sequencing (2 weeks)

| Day     | Action                                                                                  |
| ------- | --------------------------------------------------------------------------------------- |
| 1       | Upload social preview image (Settings → Social preview, use cover_image.png)            |
| 1       | Cut release v0.3.0 with contributor shoutouts — notifies all watchers                   |
| 2       | GSSoC Discord message + badge Discussion pinned                                         |
| 3       | dev.to article                                                                          |
| 5       | Reddit r/opensource                                                                     |
| 6 (Sat) | r/webdev Showoff Saturday                                                               |
| 8       | Show HN (weekday morning US time, link the dev.to piece in comments if asked for depth) |
| 9-14    | Awesome-list PRs, alternativeto listing, LinkedIn/X post                                |
