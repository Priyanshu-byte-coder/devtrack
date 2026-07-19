'use client';

import { useState } from 'react';
import type { RoomMember } from '@/types/rooms';
import InviteModal from './InviteModal';

interface Props {
  roomId: string;
  members: RoomMember[];
  isOwner: boolean;
  onMemberAdded: (username: string) => void;
  onMemberRemoved: (username: string) => void;
}

export default function MembersPanel({ roomId, members, isOwner, onMemberAdded, onMemberRemoved }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const [removingUsername, setRemovingUsername] = useState<string | null>(null);

  async function handleRemove(username: string) {
    if (!confirm(`Remove ${username} from this room?`)) return;
    setRemovingUsername(username);
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/members/${encodeURIComponent(username)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        onMemberRemoved(username);
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error ?? 'Failed to remove member');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setRemovingUsername(null);
    }
  }

  return (
    <aside className="w-full md:w-56 shrink-0 border-l dark:border-gray-800 flex flex-col">
      <div className="p-4 border-b dark:border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Members ({members.length})
        </h3>
        {isOwner && (
          <button
            onClick={() => setShowInvite(true)}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/60"
          >
            + Invite
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-2 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://github.com/${encodeURIComponent(m.github_username)}.png?size=32`}
              alt={m.github_username}
              className="w-7 h-7 rounded-full shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{m.github_username}</p>
              {m.role === 'owner' && (
                <span className="text-[10px] text-yellow-600 dark:text-yellow-400">owner</span>
              )}
            </div>
            {isOwner && m.role !== 'owner' && (
              <button
                onClick={() => handleRemove(m.github_username)}
                disabled={removingUsername === m.github_username}
                aria-label={`Remove ${m.github_username}`}
                className="shrink-0 text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
              >
                {removingUsername === m.github_username ? '…' : '✕'}
              </button>
            )}
          </div>
        ))}
      </div>

      {showInvite && (
        <InviteModal
          roomId={roomId}
          onClose={() => setShowInvite(false)}
          onInvited={(username) => {
            onMemberAdded(username);
            setShowInvite(false);
          }}
        />
      )}
    </aside>
  );
}
