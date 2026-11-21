"use client";

import NextLink from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

type LinkProps = ComponentPropsWithoutRef<typeof NextLink>;

/**
 * next/link with prefetching off unless a link asks for it.
 *
 * Next.js prefetches every <Link> that scrolls into view. On DevTrack one
 * visit to /leaderboard fired 45 background requests (28 profiles), each a
 * middleware run plus a server render billed as Active CPU, and none of them
 * cacheable. On the Hobby plan that multiplied the cost of every page view.
 * Pages still load on click; pass `prefetch` explicitly where a link is very
 * likely to be followed.
 */
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { prefetch = false, ...props },
  ref
) {
  return <NextLink ref={ref} prefetch={prefetch} {...props} />;
});

export default Link;
