/// <reference types="react" />

'use client';

import React, { useState, type FormEvent } from 'react';
import type { CollaborationRoom, CreateRoomPayload } from '@/types/rooms';

interface Props {
  onClose: () => void;
  onCreated: (room: CollaborationRoom) => void;
}

export default function CreateRoomModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<CreateRoomPayload>({
    name: '',
    description: '',
    repo_owner: '',
    repo_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? 'Failed to create room');
        return;
      }

      onCreated(data);
      onClose();
    } catch {
      setError('Failed to create room');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Create Collaboration Room</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Room Name *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
              placeholder="e.g. Frontend Team"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">GitHub Repo Owner *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
              placeholder="e.g. vercel"
              value={form.repo_owner}
              onChange={(e) => setForm({ ...form, repo_owner: e.target.value })}
              maxLength={39}
              pattern="[a-zA-Z0-9]([a-zA-Z0-9\-]{0,37}[a-zA-Z0-9])?|[a-zA-Z0-9]"
              title="Valid GitHub username: 1–39 alphanumeric characters or hyphens, cannot start or end with a hyphen"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Repository Name *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
              placeholder="e.g. next.js"
              value={form.repo_name}
              onChange={(e) => setForm({ ...form, repo_name: e.target.value })}
              maxLength={100}
              pattern="[a-zA-Z0-9._\-]{1,100}"
              title="Valid GitHub repository name: 1–100 alphanumeric characters, hyphens, underscores, or dots"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700 resize-none"
              rows={3}
              placeholder="What is this room for?"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={500}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>

    </>
  );
}
