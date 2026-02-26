import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            padding: "20px",
            background: "rgba(255, 0, 0, 0.05)",
            border: "1px solid rgba(255, 0, 0, 0.2)",
            borderRadius: "4px",
            color: "#e0e0e0",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
          }}
        >
          <div style={{ marginBottom: "8px", color: "#ff4444", fontWeight: 600 }}>
            {this.props.name ? `[${this.props.name}] ` : ""}Component Error
          </div>
          <pre style={{ margin: "0 0 12px", whiteSpace: "pre-wrap", opacity: 0.7 }}>
            {this.state.error?.message ?? "An unexpected error occurred"}
          </pre>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              background: "transparent",
              border: "1px solid #666",
              color: "#e0e0e0",
              padding: "4px 12px",
              borderRadius: "3px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "11px",
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
