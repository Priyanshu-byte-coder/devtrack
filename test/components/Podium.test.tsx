import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import Podium, {
  type PodiumPlace,
} from "../../src/components/leaderboard/Podium";

function place(username: string, value: string, isYou = false): PodiumPlace {
  return {
    username,
    avatarUrl: `https://avatars.githubusercontent.com/${username}?s=144`,
    profileUrl: `/u/${username}`,
    value,
    valueLabel: "score",
    tier: "gold",
    scoreV2: 500,
    isYou,
  };
}

describe("Podium", () => {
  it("keeps rank order in the DOM and lays it out 2nd, 1st, 3rd", () => {
    const html = renderToString(
      <Podium
        places={[
          place("ada", "929"),
          place("linus", "794"),
          place("grace", "710"),
        ]}
      />
    );
    const order = ["ada", "linus", "grace"].map((n) => html.indexOf(`/u/${n}`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("1st place");
    expect(html.indexOf("order-2")).toBeLessThan(html.indexOf("order-1"));
  });

  it("marks the viewer and handles a board shorter than three", () => {
    const html = renderToString(<Podium places={[place("ada", "12", true)]} />);
    expect(html).toContain(">You<");
    expect(html).not.toContain("2nd place");
  });

  it("only crowns first place", () => {
    const html = renderToString(
      <Podium places={[place("ada", "3"), place("linus", "2")]} />
    );
    expect(html.match(/viewBox="0 0 8 5"/g)).toHaveLength(1);
  });
});
