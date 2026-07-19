import { decryptToken } from "@/lib/crypto";
import { supabaseAdmin } from "@/lib/supabase";

interface UserGitHubAccountRow {
  github_id?: string;
  github_login?: string;
  access_token_encrypted: string;
  access_token_iv: string;
}

interface GitHubRateLimitResponse {
  resources?: {
    core?: {
      remaining?: number;
    };
  };
}

export interface LinkedAccount {
  githubId: string;
  githubLogin: string;
  token: string;
}

export async function getLinkedTokens(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_github_accounts")
    .select("access_token_encrypted, access_token_iv")
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to fetch linked accounts");
  }

  const rows = (data ?? []) as UserGitHubAccountRow[];
  const tokens: string[] = [];

  for (const row of rows) {
    try {
      const decrypted = decryptToken(row.access_token_encrypted, row.access_token_iv);
      if (decrypted) {
        tokens.push(decrypted);
      }
    } catch (err) {
      console.error(JSON.stringify({
        event: "token_decryption_failure",
        userId,
        githubId: row.github_id,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString()
      }));
    }
  }

  return tokens;
}

export async function getRateLimitRemaining(token: string): Promise<number> {
  try {
    const response = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return 0;
    }

    const data = (await response.json()) as GitHubRateLimitResponse;
    const remaining = data.resources?.core?.remaining;

    return typeof remaining === "number" ? remaining : 0;
  } catch (e) {
    return 0;
  }
}

export async function pickBestToken(tokens: string[]): Promise<string> {
  if (tokens.length === 0) {
    throw new Error("No tokens available");
  }

  const remainingValues = await Promise.all(
    tokens.map((token) => getRateLimitRemaining(token))
  );

  let bestIndex = 0;

  for (let i = 1; i < remainingValues.length; i++) {
    if (remainingValues[i] > remainingValues[bestIndex]) {
      bestIndex = i;
    }
  }

  return tokens[bestIndex];
}

export async function getAllTokens(
  primaryToken: string,
  userId: string
): Promise<string[]> {
  const linkedTokens = await getLinkedTokens(userId);

  const dedupedLinkedTokens = linkedTokens.filter(
    (token) => token !== primaryToken
  );

  return [primaryToken, ...dedupedLinkedTokens];
}

export async function getLinkedAccounts(
  userId: string
): Promise<LinkedAccount[]> {
  const { data, error } = await supabaseAdmin
    .from("user_github_accounts")
    .select(
      "github_id, github_login, access_token_encrypted, access_token_iv"
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error("Failed to fetch linked accounts");
  }

  const rows = (data ?? []) as UserGitHubAccountRow[];

  return rows
    .map((row) => {
      const token = decryptToken(
        row.access_token_encrypted,
        row.access_token_iv
      );

      if (!token) {
        return null;
      }

      return {
        githubId: row.github_id ?? "",
        githubLogin: row.github_login ?? "",
        token,
      };
    })
    .filter((account): account is LinkedAccount => account !== null);
}

export async function getAllAccounts(
  primary: { token: string; githubId: string; githubLogin: string },
  userId: string
): Promise<LinkedAccount[]> {
  const linkedAccounts = await getLinkedAccounts(userId);

  const filteredLinkedAccounts = linkedAccounts.filter(
    (account) => account.githubId !== primary.githubId
  );

  return [
    {
      token: primary.token,
      githubId: primary.githubId,
      githubLogin: primary.githubLogin,
    },
    ...filteredLinkedAccounts,
  ];
}

export async function getAccountToken(
  userId: string,
  accountGithubId: string
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("user_github_accounts")
    .select("access_token_encrypted, access_token_iv")
    .eq("user_id", userId)
    .eq("github_id", accountGithubId)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as UserGitHubAccountRow;

  try {
    return decryptToken(row.access_token_encrypted, row.access_token_iv);
  } catch (err) {
    console.error(JSON.stringify({
      event: "account_token_decryption_failure",
      userId,
      accountGithubId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString()
    }));
    return null;
  }
}

export function mergeMetrics<T>(
  results: PromiseSettledResult<T>[],
  merge: (a: T, b: T) => T
): T | null {
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<T> =>
      result.status === "fulfilled"
  );

  if (fulfilled.length === 0) {
    return null;
  }

  if (fulfilled.length === 1) {
    return fulfilled[0].value;
  }

  return fulfilled
    .slice(1)
    .reduce((acc, result) => merge(acc, result.value), fulfilled[0].value);
}