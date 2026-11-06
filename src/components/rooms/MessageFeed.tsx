"use client";

import { useEffect, useRef } from "react";
import type { RoomMessage } from "@/types/rooms";

interface Props {
  roomId: string;
  currentUser: string;
  messages: RoomMessage[];
  onNewMessages: (msgs: RoomMessage[]) => void;
}

export default function MessageFeed({
  roomId,
  currentUser,
  messages,
  onNewMessages,
}: Props) {
  const latestMessages = useRef(messages);
  useEffect(() => {
    latestMessages.current = messages;
  }, [messages]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever new messages arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // The API verifies stable membership identity before returning messages.
  useEffect(() => {
    if (!roomId) return;
    const controller = new AbortController();
    let pending = false;
    let cursor = latestMessages.current.at(-1);
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const query = cursor
          ? `?after=${encodeURIComponent(cursor.created_at)}&afterId=${encodeURIComponent(cursor.id)}`
          : "";
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(roomId)}/messages${query}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length) {
            onNewMessages(data);
            cursor = data.at(-1);
          }
        }
      } catch {
        /* Keep existing messages during a temporary disconnect. */
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [roomId, onNewMessages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && (
        <p className="text-center text-sm text-[var(--muted-foreground)] mt-8">
          No messages yet. Start the conversation!
        </p>
      )}

      {messages.map((msg) => {
        const isMe = msg.sender_username === currentUser;
        return (
          <div
            key={msg.id}
            className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* eslint-disable @next/next/no-img-element */}
            {msg.sender_avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={msg.sender_avatar}
                alt={msg.sender_username}
                className="w-8 h-8 rounded-full shrink-0 mt-1"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-300 shrink-0 mt-1 flex items-center justify-center text-xs font-bold">
                {msg.sender_username[0].toUpperCase()}
              </div>
            )}

            <div
              className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}
            >
              {!isMe && (
                <span className="text-xs text-[var(--muted-foreground)] mb-0.5 ml-1">
                  {msg.sender_username}
                </span>
              )}
              <div
                className={`px-3 py-2 rounded-2xl text-sm break-words ${
                  isMe
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] rounded-tr-sm"
                    : "bg-[var(--control)] text-[var(--foreground)] rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-[var(--muted-foreground)] mt-0.5 mx-1">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
