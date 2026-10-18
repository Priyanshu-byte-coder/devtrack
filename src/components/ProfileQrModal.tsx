"use client";

import { useEffect, useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface ProfileQrModalProps {
  /** The full public profile URL to encode, e.g. https://devtrack-silk-kappa.vercel.app/u/johndoe */
  profileUrl: string;
  /** Display name shown in the modal header */
  username: string;
  /** Called when the user dismisses the modal */
  onClose: () => void;
}

/**
 * ProfileQrModal
 *
 * Renders a centered modal containing a scannable QR code for the given
 * profile URL, plus a "Download QR Code" button that saves a PNG.
 *
 * Usage:
 *   import { useState } from "react";
 *   import { ProfileQrModal } from "@/components/ProfileQrModal";
 *
 *   const [showQr, setShowQr] = useState(false);
 *
 *   <button onClick={() => setShowQr(true)}>Show QR Code</button>
 *   {showQr && (
 *     <ProfileQrModal
 *       profileUrl={`https://devtrack-silk-kappa.vercel.app/u/${username}`}
 *       username={username}
 *       onClose={() => setShowQr(false)}
 *     />
 *   )}
 *
 * Dependencies (add to package.json):
 *   npm install react-qr-code
 */
export function ProfileQrModal({
  profileUrl,
  username,
  onClose,
}: ProfileQrModalProps) {
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Prevent background scroll while modal is open. Restore the previous
  // inline overflow instead of hardcoding "" so we don't clobber a value
  // that was already set before this modal mounted.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleDownload = useCallback(() => {
    // QRCodeCanvas renders a <canvas>, so the pixels are already there — read
    // them straight off it. A previous version looked for a <svg> here, which
    // this component has never rendered, so the button silently did nothing.
    const source = qrContainerRef.current?.querySelector("canvas");
    if (!source) return;

    const padding = 24; // px of white border around the QR code
    const canvas = document.createElement("canvas");
    canvas.width = source.width + padding * 2;
    canvas.height = source.height + padding * 2;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background so the code still scans when saved on a dark theme.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, padding, padding);

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `devtrack-${username}-qr.png`;
    link.click();
  }, [username]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={handleBackdropClick}
    >
      {/* Panel */}
      <div className="relative mx-4 flex w-full max-w-sm flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-8 py-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close QR code modal"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--control)] hover:text-[var(--foreground)]"
        >
          {/* ✕ icon (inline SVG to avoid icon-library coupling) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Heading */}
        <h2
          id="qr-modal-title"
          className="mb-1 text-lg font-semibold text-[var(--foreground)]"
        >
          Share Profile
        </h2>
        <p className="mb-6 text-sm text-[var(--muted-foreground)]">
          Scan to visit&nbsp;
          <span className="font-medium text-[var(--foreground)]">
            @{username}
          </span>
          &apos;s DevTrack profile
        </p>

        {/* QR code — rendered in a white box so it scans on dark themes too */}
        <div
          ref={qrContainerRef}
          className="rounded-xl bg-white p-4 shadow-inner"
        >
          <QRCodeCanvas
            value={profileUrl}
            size={200}
            level="H"
            bgColor="#ffffff"
            fgColor="#111827"
          />
        </div>

        {/* Profile URL (read-only, copyable) */}
        <p
          className="mt-4 max-w-full truncate text-center text-xs text-[var(--muted-foreground)]"
          title={profileUrl}
        >
          {profileUrl}
        </p>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
        >
          {/* Download icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download QR Code
        </button>
      </div>
    </div>
  );
}
