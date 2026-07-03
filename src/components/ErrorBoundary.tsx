import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children?: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };
  public static getDerivedStateFromError(_: Error): State { return { hasError: true }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error('Uncaught error:', error, errorInfo); }
  public render() { if (this.state.hasError) { return this.props.fallback || <h1>Something went wrong.</h1>; } return this.props.children; }
}
