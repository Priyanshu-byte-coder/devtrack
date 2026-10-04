export function getAppBaseUrl(origin?: string): string {
  const base =
    origin ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";

  return base.replace(/\/$/, "");
}

export function getProfileUrl(username: string, origin?: string): string {
  return `${getAppBaseUrl(origin)}/u/${username}`;
}
