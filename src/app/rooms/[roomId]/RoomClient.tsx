'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { CollaborationRoom, RoomMember, RoomMessage } from '@/types/rooms';
import MessageFeed from '@/components/rooms/MessageFeed';
import MessageInput from '@/components/rooms/MessageInput';
import MembersPanel from '@/components/rooms/MembersPanel';

interface Props {
  room: CollaborationRoom & { is_owner: boolean };
  initialMembers: RoomMember[];
  initialMessages: RoomMessage[];
  currentUser: string;
  currentUserAvatar: string | null;
}

export default function RoomClient({
  room, initialMembers, initialMessages, currentUser,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<RoomMessage[]>(initialMessages);
  const [members, setMembers] = useState<RoomMember[]>(initialMembers);
  const [deleting, setDeleting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  // Optimistic update: immediately show the message the current user just sent.
  function handleSent(msg: RoomMessage) {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }

  // Called by MessageFeed's polling loop with messages from other participants.
  // useCallback prevents the effect in MessageFeed from restarting on every render.
  const handleNewMessages = useCallback((incoming: RoomMessage[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const novel = incoming.filter((m) => !existingIds.has(m.id));
      return novel.length > 0 ? [...prev, ...novel] : prev;
    });
  }, []);

  function handleMemberAdded(username: string) {
    setMembers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        room_id: room.id,
        github_username: username,
        role: 'member',
        joined_at: new Date().toISOString(),
      },
    ]);
  }

  function handleMemberRemoved(username: string) {
    setMembers((prev) => prev.filter((m) => m.github_username !== username));
  }

  async function handleDeleteRoom() {
    if (!confirm('Are you sure you want to delete this room? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/rooms');
      } else {
        const data = await res.json();
        alert(data.error ?? 'Failed to delete room');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to delete room. Please check your connection.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleLeaveRoom() {
    if (!confirm('Are you sure you want to leave this room?')) return;
    const res = await fetch(`/api/rooms/${room.id}/members/${encodeURIComponent(currentUser)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      router.push('/rooms');
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to leave room');
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/rooms" className="text-sm text-gray-400 hover:text-gray-600">
            ← Rooms
          </Link>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <div>
            <h1 className="font-semibold text-base leading-tight">{room.name}</h1>
            <a
              href={`https://github.com/${room.repo_owner}/${room.repo_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline"
            >
              {room.repo_owner}/{room.repo_name}
            </a>
          </div>
        </div>
        <button
          onClick={() => setShowMembers(true)}
          className="md:hidden text-xs px-3 py-1.5 border border-[var(--border)] rounded-lg"
        >
        Members
        </button>
        {room.is_owner ? (
          <button
            onClick={handleDeleteRoom}
            disabled={deleting}
            className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? 'Deleting...' : 'Delete Room'}
          </button>
        ) : (
          <button
            onClick={handleLeaveRoom}
            className="text-xs px-3 py-1.5 border border-red-400 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Leave Room
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <MessageFeed
            roomId={room.id}
            currentUser={currentUser}
            messages={messages}
            onNewMessages={handleNewMessages}
          />
          <MessageInput roomId={room.id} onSent={handleSent} />
        </div>
        <div className="hidden md:block">
          <MembersPanel
            roomId={room.id}
            members={members}
            isOwner={room.is_owner}
            onMemberAdded={handleMemberAdded}
            onMemberRemoved={handleMemberRemoved}
          />
        </div>
        {showMembers && (
  <div className="fixed inset-0 z-50 md:hidden">
    <div
      className="absolute inset-0 bg-black/50"
      onClick={() => setShowMembers(false)}
    />

    <div className="absolute right-0 top-0 h-full w-72 bg-[var(--background)]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h2 className="font-semibold">Members</h2>

        <button
          onClick={() => setShowMembers(false)}
          className="text-sm px-2 py-1 border rounded"
        >
          Close
        </button>
      </div>

      <MembersPanel
        roomId={room.id}
        members={members}
        isOwner={room.is_owner}
        onMemberAdded={handleMemberAdded}
        onMemberRemoved={handleMemberRemoved}
      />
    </div>
  </div>
        )}
      </div>
    </div>
  );
}
