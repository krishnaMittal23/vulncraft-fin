import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const MONO = { fontFamily: "'JetBrains Mono', monospace" } as const;

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = import.meta.env.DEV;

    return (
      <div
        style={{
          ...MONO,
          minHeight: "100vh",
          width: "100%",
          backgroundColor: "#09090b",
          color: "#e5e1e4",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem", width: "100%" }}>
          <p
            style={{
              color: "#4be277",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontSize: "0.75rem",
              marginBottom: "1rem",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            The app hit an unexpected error
          </h1>
          <p style={{ color: "#bccbb9", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
            Try reloading the page. If the problem persists, please contact support.
          </p>

          {isDev && this.state.error && (
            <pre
              style={{
                textAlign: "left",
                backgroundColor: "#131315",
                border: "1px solid rgba(63,63,70,0.5)",
                borderRadius: "0.5rem",
                padding: "1rem",
                fontSize: "0.75rem",
                color: "#ef4444",
                overflowX: "auto",
                marginBottom: "1.5rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleReload}
            style={{
              ...MONO,
              backgroundColor: "#4be277",
              color: "#003915",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.5rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
