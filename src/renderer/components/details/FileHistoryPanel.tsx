import React, { useState, useEffect } from "react";
import { DiffViewer } from "../diff/DiffViewer";
import type { CommitInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
}

export const FileHistoryPanel: React.FC<Props> = ({ open, onClose, filePath }) => {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !filePath) return;
    setLoading(true);
    setSelectedHash(null);
    setDiff("");
    window.electronAPI.history
      .file(filePath)
      .then(setCommits)
      .catch(() => setCommits([]))
      .finally(() => setLoading(false));
  }, [open, filePath]);

  useEffect(() => {
    if (!selectedHash || !filePath) {
      setDiff("");
      return;
    }
    window.electronAPI.diff
      .commitFile(selectedHash, filePath)
      .then(setDiff)
      .catch(() => setDiff(""));
  }, [selectedHash, filePath]);

  if (!open) return null;

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
        animation: "fade-in 0.15s ease-out",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "85vw",
          maxWidth: 950,
          height: "75vh",
          maxHeight: 650,
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modal-in 0.2s ease-out",
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              File History
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {filePath}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Commit list */}
          <div
            style={{
              width: 320,
              minWidth: 250,
              borderRight: "1px solid var(--border-subtle)",
              overflowY: "auto",
            }}
          >
            {loading && (
              <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                Loading...
              </div>
            )}
            {!loading && commits.length === 0 && (
              <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
                No history found
              </div>
            )}
            {commits.map((c) => (
              <div
                key={c.hash}
                onClick={() => setSelectedHash(c.hash)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: selectedHash === c.hash ? "var(--accent-dim)" : "transparent",
                  borderLeft: selectedHash === c.hash ? "2px solid var(--accent)" : "2px solid transparent",
                  borderBottom: "1px solid var(--border-subtle)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (selectedHash !== c.hash) e.currentTarget.style.background = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  if (selectedHash !== c.hash) e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 2 }} className="truncate">
                  {c.subject}
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--text-muted)" }}>
                  <span className="mono">{c.abbreviatedHash}</span>
                  <span>{c.authorName}</span>
                  <span>{formatShortDate(c.authorDate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Diff */}
          <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
            {selectedHash ? (
              diff ? (
                <DiffViewer rawDiff={diff} />
              ) : (
                <div className="empty-state"><span>Loading diff...</span></div>
              )
            ) : (
              <div className="empty-state"><span>Select a commit to view changes</span></div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

function formatShortDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}
