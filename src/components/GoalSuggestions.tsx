"use client";

import { useEffect, useState } from "react";

interface Suggestion {
  title: string;
  target: number;
  unit: string;
  recurrence: string;
  reason: string;
}

export default function GoalSuggestions({
  onSelect,
}: {
  onSelect: (suggestion: Suggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/goals/suggestions")
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-xs text-[var(--muted-foreground)]">Loading suggestions...</div>;
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-[var(--muted-foreground)]">💡 Suggested Goals:</p>
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="w-full text-left rounded-lg border border-[var(--border)] bg-[var(--control)] p-2 text-xs hover:border-[var(--accent)] transition"
        >
          <div className="font-medium">{s.title}</div>
          <div className="text-[var(--muted-foreground)]">{s.reason}</div>
        </button>
      ))}
    </div>
  );
}
