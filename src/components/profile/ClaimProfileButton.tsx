"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Publishes the signed-in user's profile and joins the leaderboard. */
export default function ClaimProfileButton({ login }: { login: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const claim = async () => {
    setSaving(true);
    try {
      // Opting in to the leaderboard also makes the profile public.
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderboard_opt_in: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("Profile published. Welcome to the board!");
      router.push(`/u/${login.toLowerCase()}`);
      router.refresh();
    } catch {
      toast.error("Couldn't publish your profile. Try again in a moment.");
      setSaving(false);
    }
  };

  return (
    <Button onClick={claim} disabled={saving}>
      {saving ? "Publishing…" : "Publish and join the leaderboard"}
    </Button>
  );
}
