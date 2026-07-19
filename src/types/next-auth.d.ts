import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    githubId?: string;
    githubLogin?: string;
    gitlabToken?: string;
    /** Set to "TokenRevoked" when the stored GitHub token has been revoked and the session must be invalidated. */
    error?: "TokenRevoked";
    user?: DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubId?: string;
    githubLogin?: string;
    gitlabToken?: string;
    /** Unix ms timestamp of the last successful GitHub token liveness check. */
    accessTokenValidatedAt?: number;
    /** Set to "TokenRevoked" when GitHub returns 401 for the stored access token. */
    error?: "TokenRevoked";
  }
}
