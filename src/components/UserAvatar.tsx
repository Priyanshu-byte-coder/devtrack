"use client";

import Image from "next/image";
import { useSession } from "next-auth/react";
import { useState } from "react";

function getInitial(name?: string | null) {
  return name ? Array.from(name)[0]?.toUpperCase() ?? '?' : '?';;
}

export default function UserAvatar() {
  const { data: session } = useSession();
  const [imageFailed, setImageFailed] = useState(false);

  const name = session?.user?.name ?? session?.githubLogin ?? "GitHub user";
  const image = session?.user?.image;
  const showImage = image && !imageFailed;

  return (
    <a
      href={session?.githubLogin ? `https://github.com/${session.githubLogin}` : "#"}
      aria-label={`Open GitHub profile for ${name}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--card-foreground)] hover:bg-[var(--control)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--control)] text-sm font-semibold text-[var(--card-foreground)]">
        {showImage ? (
          <Image
            src={image}
            alt={`${name} avatar`}
            width={32}
            height={32}
            className="h-8 w-8 rounded-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{getInitial(name)}</span>
        )}
      </div>
      <span className="max-w-32 truncate text-sm font-medium leading-none text-[var(--card-foreground)]">
        {name}
      </span>
    </a>
  );
}
