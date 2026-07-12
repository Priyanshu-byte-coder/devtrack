import "server-only";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { headers, cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import type { Session } from "next-auth";

export interface SessionWithToken {
  session: Session;
  accessToken: string;
}

export async function getSessionWithToken(): Promise<SessionWithToken | null> {
  const session = await getServerSession(authOptions);
  if (!session?.githubId || !session?.githubLogin) return null;

  // accessToken no longer lives on `session` (see auth.ts session callback).
  // Read it server-side, directly from the encrypted JWT cookie instead.
  const token = await getToken({
    req: { headers: headers(), cookies: cookies() } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const accessToken = typeof token?.accessToken === "string" ? token.accessToken : null;
  if (!accessToken) return null;

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);
  if (!userRow) return null;

  return { session, accessToken };
}
export async function getAccessToken(): Promise<string | null> {
  const token = await getToken({
    req: { headers: headers(), cookies: cookies() } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });
  return typeof token?.accessToken === "string" ? token.accessToken : null;
}
