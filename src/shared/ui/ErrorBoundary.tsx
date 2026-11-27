import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/** Shows `fallback` instead of crashing the page when a child throws (e.g. a lazy chunk fails). */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
