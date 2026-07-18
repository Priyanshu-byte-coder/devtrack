"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

const plainTextClassName = "whitespace-pre-wrap break-words";

function PlainBio({ bio, className = "" }: { bio: string; className?: string }) {
  return <p className={`${plainTextClassName} ${className}`}>{bio}</p>;
}

class MarkdownErrorBoundary extends React.Component<
  { bio: string; className?: string; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Failed to render Markdown bio:", error);
  }

  render() {
    if (this.state.hasError) {
      return <PlainBio bio={this.props.bio} className={this.props.className} />;
    }

    return this.props.children;
  }
}

export default function MarkdownBio({
  bio,
  className = "",
}: {
  bio?: string | null;
  className?: string;
}) {
  const value = bio?.trim();

  if (!value) {
    return null;
  }

  return (
    <MarkdownErrorBoundary bio={value} className={className}>
      <div className={`whitespace-pre-wrap break-words text-sm leading-6 ${className}`}>
        <ReactMarkdown
          rehypePlugins={[rehypeSanitize]}
          allowedElements={["p", "strong", "em", "a", "code", "br"]}
          unwrapDisallowed
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] underline underline-offset-2 hover:opacity-80"
              >
                {children}
              </a>
            ),
            code: ({ children }) => (
              <code className="rounded border border-[var(--border)] bg-[var(--control)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--card-foreground)]">
                {children}
              </code>
            ),
          }}
        >
          {value}
        </ReactMarkdown>
      </div>
    </MarkdownErrorBoundary>
  );
}
