/** Where people can fund DevTrack. Mirrors .github/FUNDING.yml. */
export const SPONSOR_LINKS = {
  github: "https://github.com/sponsors/Priyanshu-byte-coder",
  chai: "https://www.buymeachai.in/devtrack",
} as const;

export interface PlacementSponsor {
  name: string;
  url: string;
  /** One line, shown under the name. */
  tagline: string;
}

/**
 * Companies currently paying for the sponsor slot. While this is empty the
 * slot shows a house ad for sponsoring DevTrack instead. Add an entry here
 * when a sponsorship is agreed; links get rel="sponsored".
 */
export const PLACEMENT_SPONSORS: PlacementSponsor[] = [];
