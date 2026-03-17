import React, { useEffect, useState } from "react";
import { useMcpStore } from "../../store/mcp-store";

interface Props {
  hash: string;
  onClose: () => void;
}

export const AiReviewDialog: React.FC<Props> = ({ hash, onClose }) => {
  const { reviewCommit, generating } = useMcpStore();
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReview(null);

    reviewCommit(hash)
      .then((result) => {
        if (!cancelled) setReview(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => { cancelled = true; };
  }, [hash]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "70vw",
          maxWidth: 700,
          maxHeight: "70vh",
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            AI Code Review — {hash.substring(0, 8)}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", padding: 4, fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono, monospace)",
            whiteSpace: "pre-wrap",
          }}
        >
          {generating && !review && (
            <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 40 }}>
              Analyzing commit...
            </div>
          )}
          {error && (
            <div style={{ color: "var(--red)" }}>{error}</div>
          )}
          {review && review}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "7px 16px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
