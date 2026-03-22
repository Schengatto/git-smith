import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--surface-0)",
          color: "var(--text-primary)",
          fontFamily: "system-ui, sans-serif",
          padding: 32,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 24, maxWidth: 500 }}>
          {this.state.error?.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: "10px 24px",
            background: "var(--accent)",
            color: "var(--surface-0)",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
