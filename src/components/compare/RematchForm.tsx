"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeGitHubUsername } from "@/lib/validate-github-username";
import { duelPath } from "@/lib/duel";

/** Two usernames in, a duel out. */
export default function RematchForm({
  defaultLeft = "",
  defaultRight = "",
  submitLabel = "Fight",
}: {
  defaultLeft?: string;
  defaultRight?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [left, setLeft] = useState(defaultLeft);
  const [right, setRight] = useState(defaultRight);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const a = normalizeGitHubUsername(left.replace(/^@/, ""));
    const b = normalizeGitHubUsername(right.replace(/^@/, ""));
    if (!a || !b) {
      setError("Enter two valid GitHub usernames.");
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      setError("Pick two different developers.");
      return;
    }
    setError(null);
    router.push(duelPath(a, b));
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    color: string
  ) => (
    <label className="min-w-0 flex-1">
      <span
        className="font-pixel text-[10px] uppercase tracking-[0.14em]"
        style={{ color }}
      >
        {label}
      </span>
      <span className="px-frame mt-2 flex items-center bg-[var(--card)]">
        <span
          aria-hidden="true"
          className="pl-3 font-pixel text-sm"
          style={{ color }}
        >
          @
        </span>
        <input
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder="github-username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={`${id}-hint`}
          className="w-0 min-w-0 flex-1 bg-transparent px-2 py-3 font-mono text-sm text-[var(--card-foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
        />
      </span>
    </label>
  );

  return (
    <form onSubmit={submit} aria-label="Start a duel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {field("Player 1", left, setLeft, "var(--accent)")}
        <span
          aria-hidden="true"
          className="self-center font-pixel text-lg text-[var(--muted-foreground)] sm:pb-3"
        >
          VS
        </span>
        {field("Player 2", right, setRight, "#fb7185")}
        <button type="submit" className="px-btn shrink-0">
          {submitLabel}
        </button>
      </div>
      <p
        id={`${id}-hint`}
        role={error ? "alert" : undefined}
        className={`mt-2 text-xs ${error ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"}`}
      >
        {error ?? "Any two GitHub users. No sign-up needed."}
      </p>
    </form>
  );
}
