import "server-only";
import { getServerSession } from "next-auth";
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

  const accessToken = session.accessToken;
  if (!accessToken) return null;

  const userRow = await resolveAppUser(session.githubId, session.githubLogin);
  if (!userRow) return null;

  return { session, accessToken };
}