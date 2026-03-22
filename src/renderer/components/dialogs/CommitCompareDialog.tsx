import React, { useEffect, useState, useCallback, useMemo } from "react";
import { DiffViewer } from "../diff/DiffViewer";
import type { CommitInfo, CommitFileInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  commit1: CommitInfo;
  commit2: CommitInfo;
}

const STATUS_COLORS: Record<string, string> = {
  added: "var(--green)",
  modified: "var(--yellow)",
  deleted: "var(--red)",
  renamed: "var(--blue)",
  copied: "var(--blue)",
};

const STATUS_LABELS: Record<string, string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  copied: "C",
};

export const CommitCompareDialog: React.FC<Props> = ({ open, onClose, commit1, commit2 }) => {
  const [files, setFiles] = useState<CommitFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setDiff("");
    window.electronAPI.diff
      .rangeFiles(commit1.hash, commit2.hash)
      .then(setFiles)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, commit1.hash, commit2.hash]);

  const handleFileClick = useCallback(
    (filePath: string) => {
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setDiff("");
        return;
      }
      setSelectedFile(filePath);
      setDiffLoading(true);
      window.electronAPI.diff
        .rangeFile(commit1.hash, commit2.hash, filePath)
        .then(setDiff)
        .catch(() => setDiff("Failed to load diff"))
        .finally(() => setDiffLoading(false));
    },
    [commit1.hash, commit2.hash, selectedFile]
  );

  const totalAdditions = useMemo(() => files.reduce((s, f) => s + f.additions, 0), [files]);
  const totalDeletions = useMemo(() => files.reduce((s, f) => s + f.deletions, 0), [files]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-1)",
        animation: "ccd-fade-in 0.12s ease-out",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
            background: "var(--surface-0)",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Compare Commits
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
              display: "flex",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Commit summary bar */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
            background: "var(--surface-0)",
          }}
        >
          <CommitSummary commit={commit1} label="From" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              color: "var(--text-muted)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
          <CommitSummary commit={commit2} label="To" />
        </div>

        {/* Content */}
        {loading && (
          <div
            style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 12 }}
          >
            Loading diff...
          </div>
        )}
        {error && <div style={{ color: "var(--red)", fontSize: 12, padding: 16 }}>{error}</div>}
        {!loading && !error && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Stats bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 14px",
                borderBottom: "1px solid var(--border-subtle)",
                flexShrink: 0,
                background: "var(--surface-0)",
                fontSize: 12,
                color: "var(--text-muted)",
                gap: 10,
              }}
            >
              <span>
                {files.length} file{files.length !== 1 ? "s" : ""} changed
              </span>
              {totalAdditions > 0 && (
                <span style={{ color: "var(--green)" }}>+{totalAdditions}</span>
              )}
              {totalDeletions > 0 && <span style={{ color: "var(--red)" }}>-{totalDeletions}</span>}
            </div>

            {/* File list + diff */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {/* File list */}
              <div
                style={{
                  width: 300,
                  minWidth: 200,
                  borderRight: "1px solid var(--border-subtle)",
                  overflowY: "auto",
                  flexShrink: 0,
                }}
              >
                {files.map((file) => (
                  <FileEntry
                    key={file.path}
                    file={file}
                    selected={selectedFile === file.path}
                    onClick={() => handleFileClick(file.path)}
                  />
                ))}
                {files.length === 0 && (
                  <div
                    style={{
                      padding: 24,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    No differences between these commits
                  </div>
                )}
              </div>

              {/* Diff pane */}
              <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
                {selectedFile ? (
                  diffLoading ? (
                    <div
                      style={{
                        padding: 24,
                        fontSize: 12,
                        color: "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      Loading diff...
                    </div>
                  ) : (
                    <DiffViewer rawDiff={diff} />
                  )
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    Select a file to view diff
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes ccd-fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

const CommitSummary: React.FC<{ commit: CommitInfo; label: string }> = ({ commit, label }) => (
  <div style={{ flex: 1, padding: "8px 14px", minWidth: 0 }}>
    <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 11,
          color: "var(--accent)",
          flexShrink: 0,
          background: "var(--surface-2)",
          padding: "1px 6px",
          borderRadius: 4,
        }}
      >
        {commit.abbreviatedHash}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {commit.subject}
      </span>
    </div>
  </div>
);

const FileEntry: React.FC<{
  file: CommitFileInfo;
  selected: boolean;
  onClick: () => void;
}> = ({ file, selected, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "5px 12px",
      cursor: "pointer",
      fontSize: 12,
      background: selected ? "var(--accent-dim)" : "transparent",
      borderBottom: "1px solid var(--border-subtle)",
    }}
    onMouseEnter={(e) => {
      if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = selected ? "var(--accent-dim)" : "transparent";
    }}
  >
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 10,
        fontWeight: 700,
        color: STATUS_COLORS[file.status] || "var(--text-muted)",
        background: `color-mix(in srgb, ${STATUS_COLORS[file.status] || "var(--text-muted)"} 15%, transparent)`,
        flexShrink: 0,
      }}
    >
      {STATUS_LABELS[file.status] || "?"}
    </span>
    <span
      style={{
        flex: 1,
        color: "var(--text-primary)",
        fontFamily: "monospace",
        fontSize: 11,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {file.path}
    </span>
    <span style={{ fontSize: 11, flexShrink: 0, display: "flex", gap: 4 }}>
      {file.additions > 0 && <span style={{ color: "var(--green)" }}>+{file.additions}</span>}
      {file.deletions > 0 && <span style={{ color: "var(--red)" }}>-{file.deletions}</span>}
    </span>
  </div>
);
