"use client";
import React from "react";
import Link from "next/link";
import "./ProfileCard.css";
import Image from "next/image";


export type SocialLink = {
  href: string;
  label?: string;
};

type Props = {
  name: string;
  handle?: string;
  role?: string;
  bio?: string;
  avatarUrl?: string;
  socials?: SocialLink[];
  className?: string;
  showAddBioHint?: boolean;
};

export default function ProfileCard({
  name,
  handle,
  role,
  bio,
  avatarUrl,
  socials = [],
  className = "",
  showAddBioHint = false,
}: Props) {
  const displayBio = bio?.trim() ?? "";

  return (
    <article className={`profile-card ${className}`.trim()} aria-label={`Profile card: ${name}`}>
      <div className="profile-card__left">
        <div className="profile-card__leftHeader">
          <Image
            src={avatarUrl || "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=512&q=80&auto=format&fit=crop"}
            alt={`Avatar of ${name}`}
            width={128}
            height={128}
            className="profile-card__avatar profile-card__avatar--large"
            unoptimized
          />

          <div className="profile-card__meta">
            <h3 className="profile-card__name">{name}</h3>
            {handle && <div className="profile-card__handle">@{handle}</div>}
            {role && <div className="profile-card__role">{role}</div>}
          </div>
        </div>

        <span className="profile-card__status" aria-hidden="true" />
      </div>

      <div className="profile-card__body">
        {displayBio ? (
          <p className="profile-card__bio">{displayBio}</p>
        ) : showAddBioHint ? (
          <p className="profile-card__bio profile-card__bio--empty">
            <Link href="/dashboard/settings">Add a bio</Link> in Settings.
          </p>
        ) : null}
      </div>

      {socials.length > 0 && (
        <footer className="profile-card__footer">
          <ul className="profile-card__socials">
            {socials.map((s, i) => (
              <li key={i} className="profile-card__social">
                <span className="profile-card__social-badge" aria-hidden="true" />
                <a href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label || s.href}>
                  {/* Small inline icons matching labels */}
                  {s.label && s.label.toLowerCase().includes("github") && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.45-3.88-1.45-.53-1.36-1.3-1.72-1.3-1.72-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.11-.75.41-1.27.75-1.56-2.55-.29-5.23-1.27-5.23-5.64 0-1.25.45-2.27 1.19-3.07-.12-.29-.52-1.45.11-3.02 0 0 .97-.31 3.18 1.17.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.21-1.49 3.18-1.17 3.18-1.17.63 1.57.23 2.73.11 3.02.74.8 1.19 1.82 1.19 3.07 0 4.38-2.69 5.35-5.25 5.63.42.36.79 1.07.79 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56C20.71 21.39 24 17.08 24 12c0-6.27-5.23-11.5-12-11.5z"/></svg>
                  )}
                  {s.label && s.label.toLowerCase().includes("twitter") && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 4.56c-.8.36-1.66.6-2.56.71.92-.56 1.62-1.44 1.95-2.5-.86.52-1.8.9-2.8 1.1C18.7 2.5 17.54 2 16.3 2c-2.2 0-3.98 1.77-3.98 3.96 0 .31.04.61.1.9C8.1 6.7 4.3 4.8 1.67 1.65c-.34.6-.54 1.3-.54 2.04 0 1.4.71 2.63 1.8 3.36-.66-.02-1.28-.2-1.83-.5v.05c0 1.93 1.38 3.54 3.22 3.9-.34.09-.7.14-1.07.14-.26 0-.52-.02-.77-.07.52 1.62 2.03 2.79 3.82 2.83C6.2 17.6 4.4 18.3 2.5 18.3c-.34 0-.68-.02-1.01-.06 1.86 1.2 4.07 1.92 6.44 1.92 7.73 0 11.96-6.4 11.96-11.95 0-.18-.01-.36-.02-.54.82-.6 1.53-1.35 2.09-2.2z"/></svg>
                  )}
                  {s.label && s.label.toLowerCase().includes("linkedin") && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 0H5C3.3 0 2 .75 2 2v20c0 1.25 1.3 2 3 2h14c1.7 0 3-.75 3-2V2c0-1.25-1.3-2-3-2zM8.5 20H5.5V9h3v11zM7 7.6C6 7.6 5 6.5 5 5.2 5 3.9 6 2.8 7 2.8c1 0 1.5 1.1 1.5 2.4 0 1.3-.5 2.4-1.5 2.4zM20 20h-3v-6c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.8 1.3-.1.3-.1.7-.1 1.1V20h-3V9h3v1.5c.4-.7 1.2-1.7 3-1.7 2.2 0 3.8 1.4 3.8 4.6V20z"/></svg>
                  )}
                  <span className="profile-card__social-text">{s.label || s.href}</span>
                </a>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  );
}
