'use client';

import { useEffect, useState } from 'react';
import type { RoomInvite } from '@/types/rooms';

export default function PendingInvites() {
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/rooms/invites')
      .then((res) => res.json())
      .then((data) => setInvites(data.invites ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function respond(inviteId: string, action: 'accept' | 'decline') {
    setRespondingId(inviteId);
    try {
      const res = await fetch(`/api/rooms/invites/${inviteId}/${action}`, { method: 'POST' });
      if (res.ok) {
        setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? `Failed to ${action} invite`);
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setRespondingId(null);
    }
  }

  if (loading || invites.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      <h2 className="text-sm font-semibold text-gray-500">Pending Room Invites</h2>
      {invites.map((invite) => (
        <div
          key={invite.id}
          className="flex items-center justify-between p-3 border dark:border-gray-800 rounded-xl bg-blue-50 dark:bg-blue-900/20"
        >
          <p className="text-sm">
            <span className="font-medium">{invite.invited_by}</span> invited you to join{' '}
            <span className="font-medium">{invite.room_name ?? 'a room'}</span>
          </p>
          <div className="flex gap-2 shrink-0 ml-4">
            <button
              onClick={() => respond(invite.id, 'decline')}
              disabled={respondingId === invite.id}
              className="text-xs px-3 py-1.5 rounded-lg border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              onClick={() => respond(invite.id, 'accept')}
              disabled={respondingId === invite.id}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {respondingId === invite.id ? '…' : 'Accept'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}