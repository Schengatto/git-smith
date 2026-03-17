import React, { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graph-store";
import { FileTree } from "./FileTree";
import { DiffViewer } from "../diff/DiffViewer";
import { FileHistoryPanel } from "./FileHistoryPanel";
import { BlameView } from "./BlameView";
import type { CommitFileInfo } from "../../../shared/git-types";

const IconFiles = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const CommitDetailsPanel: React.FC = () => {
  const { selectedCommit } = useGraphStore();
  const [files, setFiles] = useState<CommitFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string>("");

  useEffect(() => {
    if (!selectedCommit) {
      setFiles([]);
      setSelectedFile(null);
      setFileDiff("");
      return;
    }
    setSelectedFile(null);
    setFileDiff("");

    window.electronAPI.diff
      .commitFiles(selectedCommit.hash)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [selectedCommit?.hash]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedCommit || !selectedFile) {
      setFileDiff("");
      return;
    }
    window.electronAPI.diff
      .commitFile(selectedCommit.hash, selectedFile)
      .then(setFileDiff)
      .catch(() => setFileDiff("(Could not load diff)"));
  }, [selectedCommit?.hash, selectedFile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!selectedCommit) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <IconFiles />
        </div>
        <span>Select a commit to view files</span>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          background: "var(--surface-0)",
          padding: "8px 14px",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        Diff
        {files.length > 0 && <span style={tabBadgeStyle}>{files.length}</span>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <DiffTab
          files={files}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
          diff={fileDiff}
        />
      </div>
    </div>
  );
};

/* ── Diff Tab ── */

const DiffTab: React.FC<{
  files: CommitFileInfo[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  diff: string;
}> = ({ files, selectedFile, onSelect, diff }) => {
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [blameFile, setBlameFile] = useState<string | null>(null);

  return (
    <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
      <div
        style={{
          width: 260,
          minWidth: 180,
          borderRight: "1px solid var(--border-subtle)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto" }}>
          <FileTree files={files} selectedFile={selectedFile} onSelect={onSelect} />
        </div>
        {selectedFile && (
          <div
            style={{
              padding: "6px 8px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <SmallButton onClick={() => setHistoryFile(selectedFile)}>History</SmallButton>
            <SmallButton onClick={() => setBlameFile(selectedFile)}>Blame</SmallButton>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
        {selectedFile ? (
          <DiffViewer rawDiff={diff} />
        ) : (
          <div className="empty-state">
            <span>Select a file to view diff</span>
          </div>
        )}
      </div>

      <FileHistoryPanel
        open={!!historyFile}
        onClose={() => setHistoryFile(null)}
        filePath={historyFile || ""}
      />
      <BlameView
        open={!!blameFile}
        onClose={() => setBlameFile(null)}
        filePath={blameFile || ""}
      />
    </div>
  );
};

/* ── Shared UI ── */

const tabBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "0 5px",
  lineHeight: "16px",
  borderRadius: 8,
  background: "var(--surface-3)",
  color: "var(--text-muted)",
  marginLeft: 6,
};

const SmallButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: "4px 0",
      borderRadius: 4,
      border: "none",
      background: "var(--surface-2)",
      color: "var(--text-secondary)",
      fontSize: 10,
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.15s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-primary)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
  >
    {children}
  </button>
);
