"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, QrCode } from "lucide-react";
import CopyLinkButton from "@/components/CopyLinkButton";
import { ProfileQrModal } from "@/components/ProfileQrModal";
import {
  buildShareText,
  shareUrl,
  type ShareRank,
} from "@/lib/gamification/share-text";

interface ShareProfileSectionProps {
  username: string;
  streak: number;
  profileUrl: string;
  /** The viewer owns this profile, so the post is written in first person. */
  isOwner: boolean;
  /** Global rank, when the profile is on the leaderboard. */
  rank: ShareRank | null;
}

const BUTTON =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--control)] px-3 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-control/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

/**
 * Share a profile. The card shown here is the profile's Open Graph image, so
 * what people preview, download and see in their X or LinkedIn feed is the
 * same arcade card.
 */
export default function ShareProfileSection({
  username,
  streak,
  profileUrl,
  isOwner,
  rank,
}: ShareProfileSectionProps) {
  const [canUseNativeShare, setCanUseNativeShare] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setCanUseNativeShare(
      typeof navigator !== "undefined" && "share" in navigator
    );
  }, []);

  const text = buildShareText({ username, isOwner, rank, streak });
  const cardPath = `/u/${username.toLowerCase()}/opengraph-image`;

  const xShareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl(profileUrl, "x"))}`;
  const linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl(profileUrl, "linkedin"))}`;

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `${username} on DevTrack`,
        text,
        url: shareUrl(profileUrl, "native"),
      });
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        toast.error("Failed to open the share sheet");
      }
    }
  };

  const downloadCard = async () => {
    setDownloading(true);
    try {
      const res = await fetch(cardPath);
      if (!res.ok) throw new Error(String(res.status));
      const href = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.download = `${username}-devtrack-card.png`;
      link.href = href;
      link.click();
      URL.revokeObjectURL(href);
    } catch {
      toast.error("Couldn't download the card. Try again in a moment.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered PNG, already sized */}
          <img
            src={cardPath}
            alt={
              rank
                ? `${username}'s DevTrack card: #${rank.rank} of ${rank.total}`
                : `${username}'s DevTrack card`
            }
            width={1200}
            height={630}
            loading="lazy"
            className="aspect-[1200/630] w-full rounded-lg border border-[var(--border)] bg-[#05070f] lg:w-[340px] lg:shrink-0"
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--card-foreground)]">
              {isOwner ? "Share your card" : "Share this profile"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {text}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {canUseNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  aria-label={`Share ${username}'s profile using the device share sheet`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-foreground)] transition-colors hover:opacity-90"
                >
                  Share
                </button>
              )}
              <a
                href={xShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Share ${username}'s profile on X`}
                className={BUTTON}
              >
                <span aria-hidden="true">𝕏</span>
                <span>Post</span>
              </a>
              <a
                href={linkedInShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Share ${username}'s profile on LinkedIn`}
                className={BUTTON}
              >
                <span aria-hidden="true">in</span>
                <span>LinkedIn</span>
              </a>
              <button
                type="button"
                onClick={downloadCard}
                disabled={downloading}
                className={`${BUTTON} disabled:opacity-60`}
              >
                <Download size={16} aria-hidden="true" />
                <span>{downloading ? "Preparing…" : "Download card"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className={BUTTON}
              >
                <QrCode size={16} aria-hidden="true" />
                <span>QR code</span>
              </button>
              <CopyLinkButton url={profileUrl} />
            </div>
          </div>
        </div>
      </section>

      {showQrModal && (
        <ProfileQrModal
          onClose={() => setShowQrModal(false)}
          username={username}
          profileUrl={profileUrl}
        />
      )}
    </>
  );
}
