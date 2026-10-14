import "server-only";
import {
  getServerSession as getPublicSession,
  type NextAuthOptions,
  type Session,
} from "next-auth";
import { getToken } from "next-auth/jwt";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";

/** Server credentials must never be passed to Client Components or serialized. */
export type ServerSession = Session & {
  accessToken?: string;
  gitlabToken?: string;
};

export async function getServerSession(
  options: NextAuthOptions = authOptions
): Promise<ServerSession | null> {
  const session = await getPublicSession(options);
  if (!session || session.error === "TokenRevoked") return null;
  const cookieStore = await cookies();
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
