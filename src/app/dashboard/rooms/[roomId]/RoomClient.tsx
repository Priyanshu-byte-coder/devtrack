"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";
import type { CollaborationRoom, RoomMember, RoomMessage } from "@/types/rooms";
import MessageFeed from "@/components/rooms/MessageFeed";
import MessageInput from "@/components/rooms/MessageInput";
import MembersPanel from "@/components/rooms/MembersPanel";

interface Props {
  room: CollaborationRoom & { is_owner: boolean };
  initialMembers: RoomMember[];
  initialMessages: RoomMessage[];
  currentUser: string;
  currentUserAvatar: string | null;
}

export default function RoomClient({
  room,
  initialMembers,
  initialMessages,
  currentUser,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<RoomMessage[]>(initialMessages);
  const [members, setMembers] = useState<RoomMember[]>(initialMembers);
  useEffect(() => setMembers(initialMembers), [initialMembers]);
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
      return novel.length > 0
        ? [...prev, ...novel].sort(
            (a, b) =>
              a.created_at.localeCompare(b.created_at) ||
              a.id.localeCompare(b.id)
          )
        : prev;
    });
  }, []);

  function handleMemberAdded(_username: string) {
    // Invitations become memberships only after the recipient accepts.
    router.refresh();
  }

  function handleMemberRemoved(username: string) {
    setMembers((prev) => prev.filter((m) => m.github_username !== username));
  }

  async function handleDeleteRoom() {
    if (
      !confirm(
        "Are you sure you want to delete this room? This cannot be undone."
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/rooms");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Could not delete this room. Try again.");
      }
    } catch (e) {
      console.error(e);
      toast.error(
        "Could not reach the server. Check your connection and try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleLeaveRoom() {
    if (!confirm("Are you sure you want to leave this room?")) return;
    const res = await fetch(
      `/api/rooms/${room.id}/members/${encodeURIComponent(currentUser)}`,
      {
        method: "DELETE",
      }
    );
    if (res.ok) {
      router.push("/dashboard/rooms");
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Could not leave this room. Try again.");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[480px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/rooms"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            ← Rooms
          </Link>
          <div className="h-4 w-px bg-[var(--border)]" />
          <div>
            <h1 className="font-semibold text-base leading-tight">
              {room.name}
            </h1>
            <a
              href={`https://github.com/${room.repo_owner}/${room.repo_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent)] hover:underline"
            >
              {room.repo_owner}/{room.repo_name}
            </a>
          </div>
        </div>
        <button
          onClick={() => setShowMembers(true)}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "ml-auto mr-2 md:hidden",
          })}
        >
          Members
        </button>
        {room.is_owner ? (
          <button
            onClick={handleDeleteRoom}
            disabled={deleting}
            className={buttonVariants({ variant: "destructive", size: "sm" })}
          >
            {deleting ? "Deleting…" : "Delete room"}
          </button>
        ) : (
          <button
            onClick={handleLeaveRoom}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "text-[var(--destructive)]",
            })}
          >
            Leave room
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
