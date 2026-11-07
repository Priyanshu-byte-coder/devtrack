"use client";

import { signOut } from "next-auth/react";
import { useEffect, useId, useRef, useState } from "react";

export default function PrivacySettings() {
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteTouched, setDeleteTouched] = useState(false);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  // ── Unique, instance-safe IDs (stable across SSR and hydration) ────────────
  const uid = useId();
  const ids = {
    sectionHeading: `${uid}-privacy-heading`,
    sectionDescription: `${uid}-privacy-description`,
    exportHeading: `${uid}-export-heading`,
    exportDescription: `${uid}-export-description`,
    exportDetails: `${uid}-export-details`,
    deleteHeading: `${uid}-delete-heading`,
    deleteDescription: `${uid}-delete-description`,
    deletePanel: `${uid}-delete-panel`,
    deleteList: `${uid}-delete-list`,
    deleteInput: `${uid}-delete-confirm-input`,
    deleteInputHint: `${uid}-delete-confirm-hint`,
  };

  // Focus management for the delete confirmation flow
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteInputRef = useRef<HTMLInputElement>(null);
  const wasConfirmOpen = useRef(false);

  useEffect(() => {
    if (showDeleteConfirm) {
      deleteInputRef.current?.focus();
    } else if (wasConfirmOpen.current) {
      deleteTriggerRef.current?.focus();
    }
    wasConfirmOpen.current = showDeleteConfirm;
  }, [showDeleteConfirm]);

  // Only flag the field as invalid after the user leaves it, so screen readers
  // don't announce "invalid" on every keystroke while "DELETE" is being typed.
  const deleteTextInvalid =
    deleteTouched &&
    deleteConfirmText.length > 0 &&
    deleteConfirmText !== "DELETE";

  /** Download a portable ZIP archive of all user-owned data. */
  async function handleExportZip() {
    setDownloading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/user/export");

      if (res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as {
          retryAfterSeconds?: number;
        };
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
      setMessage({
        kind: "error",
        text: "Failed to generate export. Please try again.",
      });
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

      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to delete account",
      });
      setDeleting(false);
    }
  }

  return (
    <section
      aria-labelledby={ids.sectionHeading}
      aria-describedby={ids.sectionDescription}
      className="mt-6 px-frame bg-[var(--card)] p-6"
    >
      <h2
        id={ids.sectionHeading}
        className="mb-1 font-pixel text-sm uppercase tracking-[0.12em] text-[var(--card-foreground)]"
      >
        Privacy &amp; Data
      </h2>
      <p
        id={ids.sectionDescription}
        className="text-sm text-[var(--muted-foreground)] mb-6"
      >
        Manage your data and privacy settings
      </p>

      {message && (
        <div
          // Errors interrupt (assertive); success is announced politely.
          role={message.kind === "error" ? "alert" : "status"}
          className={`mb-4 rounded-lg border p-4 text-sm ${
            message.kind === "success"
              ? "border-success/30 bg-success/10 text-[var(--success)]"
              : "border-destructive/30 bg-destructive/10 text-[var(--destructive)]"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* ── Export Data ──────────────────────────────────────────────────── */}
        <div role="group" aria-labelledby={ids.exportHeading}>
          <h3
            id={ids.exportHeading}
            className="text-sm font-semibold text-[var(--card-foreground)] mb-2"
          >
            Export Data
          </h3>
          <p
            id={ids.exportDescription}
            className="text-sm text-[var(--muted-foreground)] mb-1"
          >
            Download a portable ZIP archive of all your DevTrack data.
          </p>
          <p
            id={ids.exportDetails}
            className="text-xs text-[var(--muted-foreground)] mb-4"
          >
            Includes: profile &amp; settings, goals &amp; goal history, streak
            data, and contribution metrics. Sensitive credentials are never
            included. Rate-limited to once per hour.
          </p>

          <button
            type="button"
            onClick={handleExportZip}
            disabled={downloading}
            aria-busy={downloading}
            aria-label={
              downloading
                ? "Preparing ZIP archive of your data"
                : "Download ZIP archive of your data"
            }
            aria-describedby={`${ids.exportDescription} ${ids.exportDetails}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <svg
                  aria-hidden="true"
                  focusable="false"
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
                  focusable="false"
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
        <div
          role="group"
          aria-labelledby={ids.deleteHeading}
          className="border-t border-[var(--border)] pt-6"
        >
          <h3
            id={ids.deleteHeading}
            className="text-sm font-semibold text-[var(--card-foreground)] mb-2"
          >
            Delete Account
          </h3>
          <p
            id={ids.deleteDescription}
            className="text-sm text-[var(--muted-foreground)] mb-4"
          >
            Permanently delete all your data from DevTrack. This action cannot
            be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              ref={deleteTriggerRef}
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              aria-expanded={false}
              aria-describedby={ids.deleteDescription}
              className="rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-[var(--destructive)] transition hover:bg-destructive/10"
            >
              Delete My Account
            </button>
          ) : (
            <div id={ids.deletePanel} className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <p
                  id={ids.deleteList}
                  className="text-sm text-[var(--destructive)] mb-3"
                >
                  This will permanently delete:
                </p>
                <ul
                  aria-labelledby={ids.deleteList}
                  className="list-disc pl-5 text-xs text-[var(--muted-foreground)] space-y-1 mb-4"
                >
                  <li>Your account and profile</li>
                  <li>All goals and progress data</li>
                  <li>Metric history and snapshots</li>
                  <li>Webhook configurations</li>
                  <li>Linked accounts and integrations</li>
                </ul>

                <label
                  htmlFor={ids.deleteInput}
                  className="block text-sm text-[var(--destructive)] mb-1"
                >
                  Type <strong>DELETE</strong> to confirm
                </label>
                <p
                  id={ids.deleteInputHint}
                  className="text-xs text-[var(--muted-foreground)] mb-3"
                >
                  Enter DELETE in capital letters. The Confirm Delete button
                  turns on once the text matches.
                </p>
                <input
                  ref={deleteInputRef}
                  id={ids.deleteInput}
                  name="delete-confirmation"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => {
                    setDeleteConfirmText(e.target.value);
                    setDeleteTouched(false);
                  }}
                  onBlur={() => setDeleteTouched(true)}
                  placeholder="DELETE"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                  disabled={deleting}
                  aria-invalid={deleteTextInvalid}
                  aria-describedby={ids.deleteInputHint}
                  className="w-full rounded-lg border border-destructive/30 bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] mb-3"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText !== "DELETE"}
                    aria-busy={deleting}
                    className="rounded-lg bg-[var(--destructive)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] transition hover:bg-destructive/90 disabled:opacity-60"
                  >
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText("");
                      setDeleteTouched(false);
                    }}
                    disabled={deleting}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--control)] disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}