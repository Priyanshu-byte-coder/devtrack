"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import type { CollaborationRoom } from "@/types/rooms";
import CreateRoomModal from "@/components/rooms/CreateRoomModal";
import PendingInvitations from "@/components/rooms/PendingInvitations";

interface Props {
  initialRooms: CollaborationRoom[];
  currentUser: string;
  loadFailed?: boolean;
}

export default function RoomsListClient({
  initialRooms,
  currentUser,
  loadFailed = false,
}: Props) {
  const [rooms, setRooms] = useState(initialRooms);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Rooms"
        description="Discussion spaces linked to a repository, for you and your collaborators."
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus aria-hidden="true" />
            New room
          </Button>
        }
      />

      {loadFailed && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-[var(--destructive-muted-border)] bg-[var(--destructive-muted)] px-3 py-2 text-sm text-[var(--destructive)]"
        >
          Rooms could not be loaded right now. Refresh to try again.
        </p>
      )}

      <PendingInvitations />

      {/* Room cards */}
      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center text-sm text-[var(--muted-foreground)]">
          No rooms yet. Create one to start a discussion around a repository.
        </div>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/dashboard/rooms/${room.id}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--accent)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">{room.name}</h2>
                  {room.description && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                      {room.description}
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono bg-[var(--control)] px-2 py-1 rounded-lg shrink-0 ml-4">
                  {room.repo_owner}/{room.repo_name}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                <span>{room.is_owner ? "👑 Owner" : "👤 Member"}</span>
                <span>·</span>
                <span>
                  Created{" "}
                  {new Date(room.created_at).toLocaleDateString("en-US")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={(room) => setRooms((prev) => [room, ...prev])}
        />
      )}
    </div>
  );
}
