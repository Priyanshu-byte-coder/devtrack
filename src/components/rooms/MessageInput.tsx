'use client';

import { useState } from 'react';
import type { RoomMessage } from '@/types/rooms';

interface Props {
  roomId: string;
  onSent: (message: RoomMessage) => void;
}

export default function MessageInput({ roomId, onSent }: Props) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });

      if (res.ok) {
        const message = await res.json();
        onSent(message);
        setContent('');
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Failed to send message. Please try again.');
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="border-t dark:border-gray-800">
      {error && (
        <p role="alert" className="px-3 pt-2 text-xs text-red-500">
          {error}
        </p>
      )}
      <form onSubmit={handleSend} className="p-3 flex gap-2 items-end">
        <textarea
          className="flex-1 resize-none border rounded-xl px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700 max-h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={1}
          placeholder="Message (Enter to send, Shift+Enter for newline)"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!content.trim() || sending}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:opacity-40 shrink-0"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
