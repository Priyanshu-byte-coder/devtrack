import { revalidateTag } from "next/cache";

/** Cache tag for one user's public profile page data. */
export function publicProfileTag(username: string) {
  return `public-profile:${username.toLowerCase()}`;
}

/** Drop a user's cached public profile immediately, e.g. after they make it private. */
export function invalidatePublicProfile(username: string) {
  revalidateTag(publicProfileTag(username), { expire: 0 });
}
