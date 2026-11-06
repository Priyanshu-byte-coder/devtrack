import "server-only";
import { githubRequest } from "@/lib/github-request";
import { throwIfGitHubRateLimited } from "@/lib/github-rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { decryptToken } from "@/lib/crypto";
/** Read exact weekly counts; snapshots are cumulative and must not be summed. */
export async function getWeeklyWebhookStats(
  userId: string,
  login: string,
  providedToken?: string
) {
  let token = providedToken;
  if (!token) {
    const { data, error } = await supabaseAdmin
      .from("user_tokens")
      .select("encrypted_token,token_iv")
      .eq("user_id", userId)
      .single();
    if (error || !data)
      throw new Error("Weekly metrics credentials unavailable");
    token = decryptToken(data.encrypted_token, data.token_iv) ?? undefined;
  }
  if (!token) throw new Error("Weekly metrics credentials unavailable");
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const deadline = AbortSignal.timeout(20000);
  const count = async (path: "commits" | "issues", query: string) => {
    const params = new URLSearchParams({ q: query, per_page: "1" });
    const response = await githubRequest(
      `https://api.github.com/search/${path}?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: deadline }
    );
    if (!response.ok) {
      throwIfGitHubRateLimited(response);
      throw new Error("Weekly metrics unavailable");
    }
    const data = (await response.json()) as {
      total_count?: number;
      incomplete_results?: boolean;
    };
    if (
      data.incomplete_results ||
      !Number.isSafeInteger(data.total_count) ||
      data.total_count! < 0
    )
      throw new Error("Weekly metrics incomplete");
    return data.total_count!;
  };
  const commits = await count(
    "commits",
    `author:${login} author-date:>=${since}`
  );
  const prs = await count(
    "issues",
    `author:${login} type:pr is:merged merged:>=${since}`
  );
  return { commits, prs };
}
