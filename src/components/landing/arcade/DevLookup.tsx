"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";

/**
 * "Look up any developer": opens /u/<login>, which works for anyone on
 * GitHub, signed up or not. The cheapest way to try DevTrack.
 */
export default function DevLookup({ className = "" }: { className?: string }) {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const login = normalizeGitHubUsername(value.replace(/^@/, ""));
    if (!login) {
      setError("That isn't a valid GitHub username.");
      return;
    }
    setError(null);
    router.push(`/u/${login.toLowerCase()}`);
  };

  return (
    <form onSubmit={submit} className={className} role="search">
      <label
        htmlFor={inputId}
        className="font-pixel text-xs uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
      >
        Look up any developer
      </label>
      <div className="mt-2 flex items-stretch">
        <div className="px-frame flex min-w-0 flex-1 items-center bg-[var(--card)]">
          <span
            aria-hidden="true"
            className="pl-3 font-pixel text-sm text-[var(--accent)]"
          >
            @
          </span>
          <input
            id={inputId}
            name="login"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="github-username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={hintId}
            aria-invalid={error ? true : undefined}
            className="w-0 min-w-0 flex-1 bg-transparent px-2 py-3 font-mono text-sm text-[var(--card-foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
          />
        </div>
        <button type="submit" className="px-btn ml-2 shrink-0">
          Go
        </button>
      </div>
      <p
        id={hintId}
        role={error ? "alert" : undefined}
        className={`mt-2 text-xs ${error ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"}`}
      >
        {error ??
          "No sign-up needed: see anyone's streak, stats and where they'd rank."}
      </p>
    </form>
  );
}
