"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  /** Optional section name shown in the error card, e.g. "Contribution Graph" */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console; replace with Sentry.captureException(error, { extra: info }) if needed
    console.error(
      `[DevTrack ErrorBoundary]${this.props.section ? ` [${this.props.section}]` : ""}`,
      error,
      info.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-sm"
        >
          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-soft)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6 text-[var(--accent)]"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--card-foreground)]">
              {this.props.section
                ? `${this.props.section} failed to load`
                : "Something went wrong here"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Try refreshing this section. If the problem persists, reload the
              page.
            </p>
          </div>

          <button
            onClick={this.handleReset}
            className="mt-1 rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}