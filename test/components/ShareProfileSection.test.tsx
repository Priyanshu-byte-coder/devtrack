import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShareProfileSection from "../../src/components/ShareProfileSection";
import {
  buildShareText,
  shareUrl,
} from "../../src/lib/gamification/share-text";

vi.mock("qrcode.react", () => ({ QRCodeCanvas: () => <canvas /> }));

const RANK = { rank: 1, total: 13, tier: "legend" as const, level: 54 };

describe("ShareProfileSection QR code", () => {
  it("opens the QR dialog on demand and closes it again", () => {
    render(
      <ShareProfileSection
        username="octocat"
        streak={3}
        profileUrl="https://devtrack.example/u/octocat"
        isOwner={false}
        rank={null}
      />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /qr code/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close QR code modal" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ShareProfileSection card and links", () => {
  it("previews the profile's real share card", () => {
    render(
      <ShareProfileSection
        username="Octocat"
        streak={3}
        profileUrl="https://devtrack.example/u/octocat"
        isOwner
        rank={RANK}
      />
    );
    const card = screen.getByRole("img", {
      name: /octocat's devtrack card: #1 of 13/i,
    });
    expect(card).toHaveAttribute("src", "/u/octocat/opengraph-image");
  });

  it("tags the X link with where it was shared", () => {
    render(
      <ShareProfileSection
        username="octocat"
        streak={3}
        profileUrl="https://devtrack.example/u/octocat"
        isOwner
        rank={RANK}
      />
    );
    const href = screen
      .getByRole("link", { name: /share octocat's profile on x/i })
      .getAttribute("href")!;
    const url = new URL(
      decodeURIComponent(new URL(href).searchParams.get("url")!)
    );
    expect(url.searchParams.get("utm_source")).toBe("x");
    expect(url.searchParams.get("utm_campaign")).toBe("share");
    expect(new URL(href).searchParams.get("text")).toContain("I'm #1 of 13");
  });
});

describe("buildShareText", () => {
  it("speaks in first person only for the owner", () => {
    expect(
      buildShareText({
        username: "octocat",
        isOwner: true,
        rank: RANK,
        streak: 0,
      })
    ).toMatch(/^I'm #1 of 13/);
    expect(
      buildShareText({
        username: "octocat",
        isOwner: false,
        rank: RANK,
        streak: 0,
      })
    ).toMatch(/^@octocat is #1 of 13/);
  });

  it("names the tier and level", () => {
    expect(
      buildShareText({
        username: "octocat",
        isOwner: true,
        rank: RANK,
        streak: 0,
      })
    ).toContain("Legend tier · LV 54");
  });

  it("falls back to the streak when the profile isn't ranked", () => {
    expect(
      buildShareText({
        username: "octocat",
        isOwner: false,
        rank: null,
        streak: 7,
      })
    ).toContain("@octocat's coding stats");
    expect(
      buildShareText({
        username: "octocat",
        isOwner: true,
        rank: null,
        streak: 7,
      })
    ).toContain("7-day streak");
  });

  it("adds UTM tags without dropping existing query parameters", () => {
    const url = new URL(
      shareUrl("https://devtrack.live/u/octocat?ref=readme", "linkedin")
    );
    expect(url.searchParams.get("ref")).toBe("readme");
    expect(url.searchParams.get("utm_source")).toBe("linkedin");
    expect(url.searchParams.get("utm_medium")).toBe("social");
  });
});
