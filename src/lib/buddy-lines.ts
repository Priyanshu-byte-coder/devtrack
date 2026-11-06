/**
 * What Bit, the pixel mascot, says on each page. Pure data and lookup, so
 * the copy is easy to edit and to test.
 *
 * `{name}` is replaced with the signed-in player's GitHub login, or
 * "player" when nobody is signed in.
 */

export interface BuddyScript {
  /** Shown in the dialog box header, like a level name. */
  stage: string;
  lines: string[];
  /** Said unprompted, once per session, a few seconds after arriving. */
  greeting?: string;
}

const DEFAULT_SCRIPT: BuddyScript = {
  stage: "DevTrack",
  lines: [
    "I'm Bit, DevTrack's resident pixel. Click me on any page for a tip.",
    "Every commit is XP. Every streak day is a combo. Don't drop it.",
    "Lost? The leaderboard is that way. I'd go look. Bravely.",
  ],
};

/** Longest prefix wins, so "/dashboard/goals" beats "/dashboard". */
const SCRIPTS: Array<[prefix: string, script: BuddyScript]> = [
  [
    "/leaderboard",
    {
      stage: "Hi-score table",
      greeting: "Oh, {name}. Back to check your rank? Again?",
      lines: [
        "Pretty sure you were #1 yesterday. No? Must have been a dream.",
        "That gap above you is totally normal. Totally. Not. Huge.",
        "Fun fact: the person above you committed while you read this.",
        "Refreshing the page doesn't raise your rank. I checked. Twice.",
        "You climbed a spot! ...Oh wait, that was someone below you falling.",
        "I'd tell you your rank, but I don't want to make this weird.",
        "Everyone here started at zero. Some of them just didn't stay there.",
        "Streaks don't grow on trees, {name}. They grow on commits.",
      ],
    },
  ],
  [
    "/compare",
    {
      stage: "Duel arena",
      lines: [
        "Two devs enter. One dev leaves with bragging rights.",
        "Pick a rival, hit fight, then share the duel card. Loser buys coffee.",
        "Pro move: challenge someone just above you. Then pass them.",
      ],
    },
  ],
  [
    "/guides",
    {
      stage: "Strategy guide",
      lines: [
        "Every good game has a strategy guide. This is ours. No cheat codes, sorry.",
        "Short on time? Each guide ends with quick answers.",
      ],
    },
  ],
  [
    "/top",
    {
      stage: "Hall of legends",
      lines: [
        "The most-followed devs on GitHub, by language and country. Study their moves.",
        "Click a legend to see their player card, or duel them. Bold.",
      ],
    },
  ],
  [
    "/u/",
    {
      stage: "Player card",
      lines: [
        "This is a player card: tier, level, streak. The whole build.",
        "Want one of these? Claim your profile and it updates by itself.",
        "The bar chart is 30 days of commits. Gold bar is the best day.",
      ],
    },
  ],
  [
    "/claim",
    {
      stage: "Character select",
      lines: [
        "Sign in with GitHub and your score goes live on the board.",
        "One click with GitHub and you're on the board. I timed it: nine seconds.",
      ],
    },
  ],
  [
    "/sponsor",
    {
      stage: "Bonus room",
      lines: [
        "Sponsors keep the arcade lights on. And my cap clean.",
        "Your logo could live here. I'd guard it with my life.",
      ],
    },
  ],
  [
    "/dashboard/activity",
    {
      stage: "Activity",
      lines: [
        "Heatmap, streaks, coding hours: everything about how you play.",
        "A streak freeze saves your streak on a rest day. Spend it wisely.",
        "Most productive hours shows when you code best. Mine's 3 AM. Send help.",
      ],
    },
  ],
  [
    "/dashboard/pull-requests",
    {
      stage: "Pull requests",
      lines: [
        "Merge rate, review speed, PR size. Small PRs merge faster. Just saying.",
        "Switch to Reviews to see the PRs you helped land. Support class!",
      ],
    },
  ],
  [
    "/dashboard/repositories",
    {
      stage: "Repositories",
      lines: [
        "Where your commits go. The loadout bar is your language build.",
        "Pin your best repos in Settings and they show on your player card.",
      ],
    },
  ],
  [
    "/dashboard/goals",
    {
      stage: "Quest log",
      lines: [
        "Quests! Pick a target in commits, PRs or active days and grind.",
        "Goals sync from GitHub on their own. No paperwork, just commits.",
      ],
    },
  ],
  [
    "/dashboard/settings",
    {
      stage: "Options",
      lines: [
        "Turn on the public leaderboard here to put your name on the board.",
        "Pick a theme. I look good in all of them. Obviously.",
      ],
    },
  ],
  [
    "/dashboard",
    {
      stage: "HQ",
      lines: [
        "Welcome to HQ, {name}. The HUD up top is your week at a glance.",
        "The quest log tracks your goals from GitHub activity on its own.",
        "Your season rank updates with every snapshot. Keep committing.",
      ],
    },
  ],
  [
    "/",
    {
      stage: "Title screen",
      lines: [
        "Type any GitHub username in score attack to see where they'd rank.",
        "Those falling blocks are contribution heatmaps. I stack them myself.",
        "Claim your profile to get your name on the hi-score table.",
      ],
    },
  ],
];

export function scriptFor(pathname: string): BuddyScript {
  let best: BuddyScript | null = null;
  let bestLength = -1;
  for (const [prefix, script] of SCRIPTS) {
    const matches =
      prefix === "/"
        ? pathname === "/"
        : pathname === prefix ||
          pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
    if (matches && prefix.length > bestLength) {
      best = script;
      bestLength = prefix.length;
    }
  }
  return best ?? DEFAULT_SCRIPT;
}

export function fillLine(line: string, login: string | null | undefined) {
  return line.replaceAll("{name}", login ? `@${login}` : "player");
}
