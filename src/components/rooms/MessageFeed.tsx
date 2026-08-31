'use client';

import { useEffect, useRef } from 'react';
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { RoomMessage } from '@/types/rooms';

interface Props {
  roomId: string;
  currentUser: string;
  messages: RoomMessage[];
  onNewMessages: (msgs: RoomMessage[]) => void;
}

export default function MessageFeed({ roomId, currentUser, messages, onNewMessages }: Props) {
  const supabase = supabaseBrowser;

  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever new messages arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Establish Supabase Realtime subscription
  useEffect(() => {
    if (!roomId) return;

    // 🧠 REALTIME SUBSCRIPTION FIX: Utilizes parent scope instance variable to eliminate variable shadowing crashes
    const channel = supabase
      .channel(`realtime:room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}` // Assumes your foreign key column is 'room_id'
        },
        (payload) => {
          // Intercept the INSERT event and append the new payload
          const incomingMessage = payload.new as RoomMessage;
          onNewMessages([incomingMessage]);
        }
      )
      .subscribe();

    // Explicit cleanup routine to unsubscribe and remove the channel instance
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, onNewMessages, supabase]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-8">
          No messages yet. Start the conversation!
        </p>
      )}

      {messages.map((msg) => {
        const isMe = msg.sender_username === currentUser;
        return (
          <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* eslint-disable @next/next/no-img-element */}
            {msg.sender_avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={msg.sender_avatar}
                alt={msg.sender_username}
                className="w-8 h-8 rounded-full shrink-0 mt-1"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 shrink-0 mt-1 flex items-center justify-center text-xs font-bold">
                {msg.sender_username[0].toUpperCase()}
              </div>
            )}

            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
              {!isMe && (
                <span className="text-xs text-gray-500 mb-0.5 ml-1">{msg.sender_username}</span>
              )}
              <div
                className={`px-3 py-2 rounded-2xl text-sm break-words ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-400 mt-0.5 mx-1">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

