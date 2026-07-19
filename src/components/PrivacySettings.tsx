"use client";

import { useState } from "react";

export default function PrivacySettings() {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  /** Download a portable ZIP archive of all user-owned data. */
  async function handleExportZip() {
    setDownloading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/export");

      if (res.status === 429) {
        const body = await res.json().catch(() => ({})) as { retryAfterSeconds?: number };
        const mins = body.retryAfterSeconds
          ? Math.ceil(body.retryAfterSeconds / 60)
          : 60;
        setMessage({
          kind: "error",
          text: `You can export once per hour. Please try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
        });
        return;
      }

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devtrack-export-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ kind: "success", text: "Export downloaded successfully." });
    } catch {
      setMessage({ kind: "error", text: "Failed to generate export. Please try again." });
    } finally {
      setDownloading(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") {
      setMessage({ kind: "error", text: "Please type DELETE to confirm" });
      return;
    }

    setDeleting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/data-export", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: "DELETE" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }

      window.location.href = "/api/auth/signout";
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to delete account",
      });
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <h2 className="text-xl font-semibold text-[var(--card-foreground)] mb-1">
        Privacy &amp; Data
      </h2>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Manage your data and privacy settings
      </p>

      {message && (
        <div
          className={`mb-4 rounded-lg border p-4 text-sm ${
            message.kind === "success"
              ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
              : "border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* ── Export Data ──────────────────────────────────────────────────── */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-2">
            Export Data
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-1">
            Download a portable ZIP archive of all your DevTrack data.
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Includes: profile &amp; settings, goals &amp; goal history, streak
            data, and contribution metrics. Sensitive credentials are never
            included. Rate-limited to once per hour.
          </p>

          <button
            type="button"
            onClick={handleExportZip}
            disabled={downloading}
            aria-label="Download ZIP archive of your data"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Preparing export…
              </>
            ) : (
              <>
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Download ZIP Archive
              </>
            )}
          </button>
        </div>

        {/* ── Delete Account ───────────────────────────────────────────────── */}
        <div className="border-t border-[var(--border)] pt-6">
          <h3 className="text-sm font-semibold text-[var(--card-foreground)] mb-2">
            Delete Account
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            Permanently delete all your data from DevTrack. This action cannot be
            undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-[var(--destructive)]/30 px-4 py-2 text-sm font-medium text-[var(--destructive)] transition hover:bg-[var(--destructive)]/10"
            >
              Delete My Account
            </button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-4">
                <p className="text-sm text-[var(--destructive)] mb-3">
                  This will permanently delete:
                </p>
                <ul className="text-xs text-[var(--muted-foreground)] space-y-1 mb-4">
                  <li>• Your account and profile</li>
                  <li>• All goals and progress data</li>
                  <li>• Metric history and snapshots</li>
                  <li>• Webhook configurations</li>
                  <li>• Linked accounts and integrations</li>
                  <li>• Local coding time data</li>
                </ul>
                <label
                  htmlFor="delete-confirm-input"
                  className="block text-sm text-[var(--destructive)] mb-3"
                >
                  Type <strong>DELETE</strong> to confirm:
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full rounded-lg border border-[var(--destructive)]/30 bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] mb-3"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText !== "DELETE"}
                    className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition hover:bg-[var(--destructive)]/90 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                    }}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--control)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
