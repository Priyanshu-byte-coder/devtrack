"use client";

import { useState } from "react";
import { ProfileQrModal } from "@/components/ProfileQrModal";

export default function QrCodeButton({ profileUrl, username }: { profileUrl: string; username: string }) {
  const [show, setShow] = useState(false);

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        Show QR Code
      </button>

      {show && (
        <ProfileQrModal
          profileUrl={profileUrl}
          username={username}
          onClose={() => setShow(false)}
        />
      )}
    </>
  );
}