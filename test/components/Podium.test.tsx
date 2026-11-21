import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import Podium, {
  type PodiumChase,
  type PodiumPlace,
} from "../../src/components/leaderboard/Podium";

function place(
  username: string,
  value: string,
  extra: Partial<PodiumPlace> = {}
): PodiumPlace {
  return {
    username,
    avatarUrl: `https://avatars.githubusercontent.com/${username}?s=144`,
    profileUrl: `/u/${username}`,
    value,
    valueLabel: "score",
    tier: "gold",
    scoreV2: 500,
    isYou: false,
    ...extra,
  };
}

function render(
  places: PodiumPlace[],
  chase: PodiumChase = { kind: "signed-out" }
) {
  return renderToString(
    <Podium places={places} caption="Overall · all time" chase={chase} />
  );
}

describe("Podium", () => {
  it("keeps rank order in the DOM and lays it out 2nd, 1st, 3rd", () => {
    const html = render([
      place("ada", "929"),
      place("linus", "794"),
      place("grace", "710"),
    ]);
    const order = ["ada", "linus", "grace"].map((n) => html.indexOf(`/u/${n}`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain("1st place");
    expect(html.indexOf("order-2")).toBeLessThan(html.indexOf("order-1"));
  });

  it("marks the viewer and handles a board shorter than three", () => {
    const html = render([place("ada", "12", { isYou: true })]);
    expect(html).toContain(">You<");
    expect(html).not.toContain("2nd place");
  });

  it("marks players the viewer follows", () => {
    const html = render([place("ada", "12", { isFollowed: true })]);
    expect(html).toContain(">Following<");
  });

  it("only crowns first place", () => {
    const html = render([place("ada", "3"), place("linus", "2")]);
    expect(html.match(/viewBox="0 0 10 7"/g)).toHaveLength(1);
  });

  it("shows the server-rendered score, not a count-up from zero", () => {
    const html = render([place("ada", "929")]);
    expect(html).toContain(">929<");
  });

  it("tells a chasing viewer how far they are from third place", () => {
    const html = render(
      [place("ada", "929"), place("linus", "794"), place("grace", "710")],
      { kind: "chasing", rank: 42, value: 690, target: 710, unit: "points" }
    );
    expect(html).toContain("#<!-- -->42");
    expect(html).toContain(">21<");
    expect(html).toMatch(/points(<!-- -->)? to #3/);
    expect(html).toContain('role="meter"');
    expect(html).toContain('href="#you"');
  });

  it("invites signed-out visitors and congratulates a viewer on the podium", () => {
    expect(render([place("ada", "929")])).toContain("Press start");
    expect(
      render([place("ada", "929")], { kind: "on-podium", rank: 1 })
    ).toContain("defend your spot");
  });
});
