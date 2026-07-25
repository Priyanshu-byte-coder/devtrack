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

  // Prevent background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleDownload = useCallback(() => {
    const svg = qrContainerRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const padding = 24; // px of white border around the QR code
    const qrSize = 256;
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, padding, padding, qrSize, qrSize);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `devtrack-${username}-qr.png`;
      link.click();
    };

    img.src = url;
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
      <div className="relative mx-4 flex w-full max-w-sm flex-col items-center rounded-2xl bg-white px-8 py-8 shadow-2xl dark:bg-gray-900">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close QR code modal"
          className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
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
          className="mb-1 text-lg font-semibold text-gray-900 dark:text-white"
        >
          Share Profile
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Scan to visit&nbsp;
          <span className="font-medium text-gray-700 dark:text-gray-300">
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
          className="mt-4 max-w-full truncate text-center text-xs text-gray-400 dark:text-gray-500"
          title={profileUrl}
        >
          {profileUrl}
        </p>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
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