"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomInvitation } from "@/types/rooms";

export default function PendingInvitations() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<RoomInvitation[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchInvitations() {
      try {
        const res = await fetch("/api/room-invitations");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setInvitations(data.invitations ?? []);
      } catch {
        // silent — pending invitations are non-critical to page load
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchInvitations();
    return () => {
      cancelled = true;
    };
  }, []);

  async function respond(invitationId: string, action: "accept" | "decline") {
    setRespondingId(invitationId);
    try {
      const res = await fetch(`/api/room-invitations/${invitationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
        if (action === "accept") router.refresh();
      }
    } finally {
      setRespondingId(null);
    }
  }

  if (loading || invitations.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      <h2 className="text-sm font-semibold text-gray-500">Pending Invitations</h2>
      {invitations.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between p-4 border dark:border-gray-800 rounded-xl bg-blue-50/50 dark:bg-blue-950/20"
        >
          <div>
            <p className="text-sm font-medium">{inv.collaboration_rooms.name}</p>
            <p className="text-xs text-gray-500">
              {inv.collaboration_rooms.repo_owner}/{inv.collaboration_rooms.repo_name} · invited by{" "}
              {inv.invited_by}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => respond(inv.id, "decline")}
              disabled={respondingId === inv.id}
              className="px-3 py-1.5 rounded-lg text-xs border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={() => respond(inv.id, "accept")}
              disabled={respondingId === inv.id}
              className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {respondingId === inv.id ? "…" : "Accept"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}