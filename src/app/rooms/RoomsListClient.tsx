'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CollaborationRoom } from '@/types/rooms';
import CreateRoomModal from '@/components/rooms/CreateRoomModal';

interface Props {
  initialRooms: CollaborationRoom[];
  currentUser: string;
}

export default function RoomsListClient({ initialRooms, currentUser }: Props) {
  const [rooms, setRooms] = useState(initialRooms);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Collaboration Rooms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Repository-linked discussion spaces for your team
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
        >
          + New Room
        </button>
      </div>

      {/* Room cards */}
      {rooms.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">No rooms yet</p>
          <p className="text-sm">Create your first collaboration room to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.id}`}
              className="block p-5 border dark:border-gray-800 rounded-2xl hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-base">{room.name}</h2>
                  {room.description && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{room.description}</p>
                  )}
                </div>
                <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg shrink-0 ml-4">
                  {room.repo_owner}/{room.repo_name}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                <span>
                  {room.is_owner ? '👑 Owner' : '👤 Member'}
                </span>
                <span>·</span>
                <span>Created {new Date(room.created_at).toLocaleDateString('en-US')}</span>
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