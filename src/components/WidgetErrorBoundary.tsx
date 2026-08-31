"use client";

import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
}

class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WidgetErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-[var(--destructive)] mb-3" />
          <p className="text-sm font-medium text-[var(--destructive)] mb-4">
            {this.props.fallbackMessage || "Unable to load widget"}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 rounded-lg bg-[var(--destructive)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
