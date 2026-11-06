# DevTrack Launch Kit

Ready-to-post copy for external distribution. Post one channel per day — spreading them out
keeps each one fresh and lets you reuse momentum ("we hit the dev.to front page yesterday").

---

## 0. Before anything: preflight

- **Google Safe Browsing must be clear.** If Search Console → Security issues lists anything, don't post: visitors would land on a red warning. Wait for the review to pass.
- Check https://devtrack.live in a fresh browser profile: no warning, sign-in works, the score attack works.
- Have the README GIF and screenshots ready to reuse (`.github/assets/readme/`).

---

## 1. Hacker News — Show HN

**Title (pick one):**

- Show HN: DevTrack – turn your GitHub activity into an arcade high score
- Show HN: A global leaderboard and pixel player cards for GitHub, built by 280 contributors

**First comment (post immediately after submitting — this is what people actually read):**

> Hi HN. DevTrack turns your GitHub activity into a game: a 0–1000 score from consistency,
> impact, volume and breadth, six tiers from Bronze to Legend, XP and levels, and a global
> leaderboard with weekly and monthly seasons.
>
> You don't need an account to try it: type any username into the "score attack" on the home
> page to see where they'd rank, or duel two developers round by round. Signed in, you get a
> dashboard (streaks, PR and review analytics, goals) and live pixel badges for your README.
>
> It started as a weekend streak tracker and grew into a community project: 280+ contributors
> and 1,100+ merged PRs, many of them first-time open-source contributions. Next.js 16,
> TypeScript, Supabase, MIT, self-hostable on free tiers.
>
> Live: https://devtrack.live
> Repo: https://github.com/Priyanshu-byte-coder/devtrack
>
> Happy to talk about the scoring (it mixes log-scaled progress with percentiles so a few
> huge accounts can't dominate) or about maintaining a high-volume open-source project.

**Rules that matter:** post 8-11am US Eastern on a weekday, never ask for upvotes or stars
in the post, reply to every comment fast for the first 3 hours.

---

## 2. Reddit

**r/github / r/opensource / r/coolgithubprojects (adapt per sub):**

Title: `I turned GitHub activity into an arcade game: score, tiers, seasons and a global leaderboard (open source, MIT)`

> DevTrack gives every GitHub user a player card: a 0–1000 score, a tier from Bronze to
> Legend, XP, and a rank on a global leaderboard with weekly and monthly seasons. Try any
> username in the score attack on the home page, no sign-up needed, or duel a friend.
>
> If you sign in you also get a full dashboard (streaks, PR review analytics, goals) and
> live pixel badges for your profile README.
>
> 280+ contributors have built it, a lot of them with their first open-source PR.
>
> Play: https://devtrack.live
> Code: https://github.com/Priyanshu-byte-coder/devtrack

**r/webdev — Showoff Saturday only.** Lead with the score-attack GIF.
**r/selfhosted** — lead with the self-hosting angle (Vercel + Supabase free tiers, Docker guide).

---

## 3. dev.to article (long-form, evergreen)

**Title options:**

- What I learned merging 1,100 PRs from 280 contributors as a student maintainer
- I turned GitHub stats into an arcade game: the scoring, the pixel art and the leaderboard

The maintainer-story angle outperforms the product angle on dev.to. Outline:

1. Hook: the fork-to-star gap (430+ forks, 270+ stars) and what it taught you about OSS funnels
2. How Hacktoberfest-style waves flooded the repo with PRs and how you triaged (labels, CI gates, AI-slop policy)
3. Designing a fair score: log-scaled targets plus percentiles, tiers and seasons
4. Building an arcade UI in Next.js: pixel sprites from character grids, `steps()` animation, reduced motion
5. Close: what you'd do differently, link the site and repo

---

## 4. LinkedIn / X post

> DevTrack just crossed 280 contributors and 1,100 merged pull requests.
>
> It turns your GitHub activity into an arcade game: a score, tiers, XP, seasons and a
> global leaderboard. Look up any developer, duel your friends, and put a live rank badge
> in your README.
>
> Built with Next.js and Supabase. MIT licensed. If you've contributed — thank you. You built this.

(Site and repo links in the first comment, not the post body — LinkedIn suppresses posts with links.)

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

DevTrack ships live pixel badges for the README (`/api/badge/rank`, `/api/badge/streak-shield`,
`/api/badge/commits`; see BADGE_API.md). Every player who adds one to their GitHub profile
README becomes a permanent backlink, and the rank badge makes people want to climb.

Do:

- Pin a Discussion titled "Add your DevTrack streak badge to your profile" with copy-paste
  markdown snippets.
- Add the snippet to the PR-merged bot comment ("show off the streak you just extended").

---

## 7. Hacktoberfest channels

Hacktoberfest (October) is the highest-leverage contributor-acquisition window of the
year — the `hacktoberfest` repo topic and issue label put DevTrack in front of people
actively looking for repos to contribute to. Post in Hacktoberfest-adjacent spaces
(r/Hacktoberfest, the official Hacktoberfest Discord's "share your project" channel,
Twitter/X with #hacktoberfest) once issues are labeled and the star-gate / contributing
guide are in good shape:

> DevTrack is participating in Hacktoberfest! It turns GitHub activity into an arcade
> game (score, tiers, seasons, duels), MIT licensed. `pnpm dev:demo` runs it with zero accounts.
> We've curated `good first issue` and `hacktoberfest` labeled issues across frontend,
> backend, and docs. PRs reviewed within 48 hours.
>
> Repo: https://github.com/Priyanshu-byte-coder/devtrack

Reuse the same message at the start and midpoint of the month — Hacktoberfest traffic is
front-loaded in week 1 but has a second wave once people realize they're short on PRs
near the deadline.

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
| 0       | Preflight: Safe Browsing clear, site checked in a fresh browser                         |
| 1       | Cut release v0.3.0 with contributor shoutouts — notifies all watchers                   |
| 2       | Hacktoberfest channel post + badge Discussion pinned                                    |
| 3       | dev.to article                                                                          |
| 5       | Reddit r/opensource                                                                     |
| 6 (Sat) | r/webdev Showoff Saturday                                                               |
| 8       | Show HN (weekday morning US time, link the dev.to piece in comments if asked for depth) |
| 9-14    | Awesome-list PRs, alternativeto listing, LinkedIn/X post                                |
