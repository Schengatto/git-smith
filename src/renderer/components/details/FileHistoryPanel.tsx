import React, { useState, useEffect, useCallback } from "react";
import { DiffViewer } from "../diff/DiffViewer";
import { useGraphStore } from "../../store/graph-store";
import type { CommitInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  filePath: string;
}

type Mode = "single" | "compare";

export const FileHistoryPanel: React.FC<Props> = ({ open, onClose, filePath }) => {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [compareTo, setCompareTo] = useState<string | null>(null);
  const [diff, setDiff] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("single");

  const { selectCommit } = useGraphStore();

  useEffect(() => {
    if (!open || !filePath) return;
    setLoading(true);
    setSelectedHash(null);
    setCompareFrom(null);
    setCompareTo(null);
    setDiff("");
    setMode("single");
    window.electronAPI.history
      .file(filePath)
      .then(setCommits)
      .catch(() => setCommits([]))
      .finally(() => setLoading(false));
  }, [open, filePath]);

  // Single mode: diff for one commit
  useEffect(() => {
    if (mode !== "single" || !selectedHash || !filePath) {
      if (mode === "single") setDiff("");
      return;
    }
    setDiff("");
    window.electronAPI.diff
      .commitFile(selectedHash, filePath)
      .then(setDiff)
      .catch(() => setDiff(""));
  }, [mode, selectedHash, filePath]);

  // Compare mode: diff between two commits
  useEffect(() => {
    if (mode !== "compare" || !compareFrom || !compareTo || !filePath) {
      if (mode === "compare") setDiff("");
      return;
    }
    setDiff("");
    window.electronAPI.diff
      .rangeFile(compareFrom, compareTo, filePath)
      .then(setDiff)
      .catch(() => setDiff(""));
  }, [mode, compareFrom, compareTo, filePath]);

  const handleCommitClick = useCallback((hash: string) => {
    if (mode === "single") {
      setSelectedHash(hash);
    } else {
      // Compare mode: first click = "from", second = "to"
      if (!compareFrom || (compareFrom && compareTo)) {
        setCompareFrom(hash);
        setCompareTo(null);
      } else {
        // Ensure older commit is "from", newer is "to"
        setCompareTo(hash);
      }
    }
  }, [mode, compareFrom, compareTo]);

  const handleModeToggle = useCallback(() => {
    const next = mode === "single" ? "compare" : "single";
    setMode(next);
    setDiff("");
    if (next === "single") {
      setCompareFrom(null);
      setCompareTo(null);
    } else {
      setSelectedHash(null);
    }
  }, [mode]);

  const handleNavigateToCommit = useCallback((hash: string) => {
    selectCommit(hash);
    onClose();
  }, [selectCommit, onClose]);

  const isSelected = (hash: string) => {
    if (mode === "single") return hash === selectedHash;
    return hash === compareFrom || hash === compareTo;
  };

  const getSelectionLabel = (hash: string): string | null => {
    if (mode !== "compare") return null;
    if (hash === compareFrom) return "A";
    if (hash === compareTo) return "B";
    return null;
  };

  if (!open) return null;

  const compareReady = mode === "compare" && compareFrom && compareTo;
  const diffHint = mode === "single"
    ? (selectedHash ? "" : "Select a commit to view changes")
    : (compareReady ? "" : "Select two commits (A and B) to compare");

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
          width: "88vw",
          maxWidth: 1050,
          height: "80vh",
          maxHeight: 720,
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
            {!loading && commits.length > 0 && (
              <span style={{
                fontSize: 10,
                color: "var(--text-muted)",
                background: "var(--surface-0)",
                padding: "1px 6px",
                borderRadius: 8,
              }}>
                {commits.length} commit{commits.length !== 1 ? "s" : ""}
              </span>
            )}
            <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>
              {filePath}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Compare mode toggle */}
            <button
              onClick={handleModeToggle}
              style={{
                background: mode === "compare" ? "var(--accent)" : "var(--surface-0)",
                color: mode === "compare" ? "var(--base)" : "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s",
              }}
              title="Compare two versions"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Compare
            </button>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, borderRadius: 4, display: "flex" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Compare mode hint */}
        {mode === "compare" && (
          <div style={{
            padding: "6px 16px",
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--surface-0)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ color: "var(--blue)", fontWeight: 600 }}>A</span>
            {compareFrom ? (
              <span className="mono" style={{ color: "var(--accent)" }}>
                {compareFrom.slice(0, 7)}
              </span>
            ) : (
              <span>select older</span>
            )}
            <span style={{ color: "var(--text-muted)" }}>&rarr;</span>
            <span style={{ color: "var(--green)", fontWeight: 600 }}>B</span>
            {compareTo ? (
              <span className="mono" style={{ color: "var(--accent)" }}>
                {compareTo.slice(0, 7)}
              </span>
            ) : (
              <span>select newer</span>
            )}
            {compareFrom && (
              <button
                onClick={() => { setCompareFrom(null); setCompareTo(null); setDiff(""); }}
                style={{
                  marginLeft: "auto",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 10,
                  textDecoration: "underline",
                }}
              >
                Reset
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Timeline commit list */}
          <div
            style={{
              width: 340,
              minWidth: 260,
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
            {commits.map((c, i) => {
              const selected = isSelected(c.hash);
              const label = getSelectionLabel(c.hash);
              const isLast = i === commits.length - 1;

              return (
                <div
                  key={c.hash}
                  onClick={() => handleCommitClick(c.hash)}
                  style={{
                    display: "flex",
                    cursor: "pointer",
                    background: selected ? "var(--accent-dim)" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Timeline column */}
                  <div style={{
                    width: 32,
                    minWidth: 32,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "relative",
                  }}>
                    {/* Top line */}
                    {i > 0 && (
                      <div style={{
                        width: 2,
                        flex: "1 1 0",
                        background: "var(--border)",
                        minHeight: 8,
                      }} />
                    )}
                    {i === 0 && <div style={{ flex: "1 1 0", minHeight: 8 }} />}
                    {/* Dot */}
                    <div style={{
                      width: label ? 18 : 10,
                      height: label ? 18 : 10,
                      borderRadius: "50%",
                      background: selected ? "var(--accent)" : "var(--border)",
                      border: selected ? "2px solid var(--accent)" : "2px solid var(--text-muted)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "var(--base)",
                      transition: "all 0.15s",
                    }}>
                      {label || ""}
                    </div>
                    {/* Bottom line */}
                    {!isLast && (
                      <div style={{
                        width: 2,
                        flex: "1 1 0",
                        background: "var(--border)",
                        minHeight: 8,
                      }} />
                    )}
                    {isLast && <div style={{ flex: "1 1 0", minHeight: 8 }} />}
                  </div>

                  {/* Commit info */}
                  <div style={{
                    flex: 1,
                    padding: "8px 10px 8px 4px",
                    overflow: "hidden",
                    borderBottom: !isLast ? "1px solid var(--border-subtle)" : "none",
                  }}>
                    <div style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      marginBottom: 3,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {c.subject}
                    </div>
                    <div style={{ display: "flex", gap: 8, fontSize: 10, color: "var(--text-muted)", alignItems: "center" }}>
                      <span className="mono" style={{ color: "var(--accent)" }}>{c.abbreviatedHash}</span>
                      <span>{c.authorName}</span>
                      <span>{formatShortDate(c.authorDate)}</span>
                      {/* Navigate to commit button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToCommit(c.hash);
                        }}
                        title="Show in graph"
                        style={{
                          marginLeft: "auto",
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: 2,
                          borderRadius: 3,
                          display: "flex",
                          opacity: 0.5,
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Diff */}
          <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
            {diff ? (
              <DiffViewer rawDiff={diff} />
            ) : (
              <div className="empty-state">
                <span>{diffHint || "Loading diff..."}</span>
              </div>
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
