import "server-only";
import {
  getServerSession as getPublicSession,
  type NextAuthOptions,
  type Session,
} from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { cache } from "react";
import { authOptions } from "@/lib/auth";

/** Server credentials must never be passed to Client Components or serialized. */
export type ServerSession = Session & {
  accessToken?: string;
  gitlabToken?: string;
};

// NextAuth splits large sessions into `<name>.0`, `<name>.1`, ...
const SESSION_COOKIE = /^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/;

/**
 * The signed-in session plus its server-only credentials. Without a session
 * cookie it returns null at once: anonymous renders and crawler visits used
 * to run NextAuth and decrypt nothing. Within one server render the result is
 * shared (React `cache`), so the layout, page and metadata don't each decrypt
 * the cookie twice. Outside a server render (tests) `cache` is unavailable
 * and every call reads afresh.
 */
export const getServerSession = (
  typeof cache === "function" ? cache : <T>(fn: T) => fn
)(readServerSession);

async function readServerSession(
  options: NextAuthOptions = authOptions
): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  if (!cookieStore.getAll().some(({ name }) => SESSION_COOKIE.test(name)))
    return null;
  const session = await getPublicSession(options);
  if (!session || session.error === "TokenRevoked") return null;
  const token = await getToken({
    req: {
      cookies: Object.fromEntries(
        cookieStore.getAll().map(({ name, value }) => [name, value])
      ),
      headers: {},
    } as Parameters<typeof getToken>[0]["req"],
    secret: options.secret,
    secureCookie:
      options.useSecureCookies ??
      process.env.NEXTAUTH_URL?.startsWith("https://") ??
      Boolean(process.env.VERCEL),
  });
  if (
    !token ||
    token.githubId !== session.githubId ||
    token.error === "TokenRevoked"
  )
    return null;
  return {
    ...session,
    accessToken:
      typeof token.accessToken === "string" ? token.accessToken : undefined,
    gitlabToken:
      typeof token.gitlabToken === "string" ? token.gitlabToken : undefined,
  };
}
