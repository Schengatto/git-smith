import React, { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graph-store";
import { FileTree } from "./FileTree";
import { DiffViewer } from "../diff/DiffViewer";
import { FileHistoryPanel } from "./FileHistoryPanel";
import { BlameView } from "./BlameView";
import type { CommitFileInfo } from "../../../shared/git-types";

const IconInfo = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

type Tab = "info" | "files";

export const CommitDetailsPanel: React.FC = () => {
  const { selectedCommit } = useGraphStore();
  const [files, setFiles] = useState<CommitFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string>("");
  const [tab, setTab] = useState<Tab>("files");

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
          <IconInfo />
        </div>
        <span>Select a commit to view details</span>
      </div>
    );
  }

  const c = selectedCommit;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <TabButton active={tab === "info"} onClick={() => setTab("info")}>
          Info
        </TabButton>
        <TabButton active={tab === "files"} onClick={() => setTab("files")}>
          Files
          {files.length > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "0 5px",
                lineHeight: "16px",
                borderRadius: 8,
                background: "var(--surface-3)",
                color: "var(--text-muted)",
                marginLeft: 6,
              }}
            >
              {files.length}
            </span>
          )}
        </TabButton>
      </div>

      {tab === "info" ? (
        <InfoTab commit={c} files={files} />
      ) : (
        <FilesTab
          files={files}
          selectedFile={selectedFile}
          onSelect={setSelectedFile}
          diff={fileDiff}
        />
      )}
    </div>
  );
};

const InfoTab: React.FC<{
  commit: NonNullable<ReturnType<typeof useGraphStore.getState>["selectedCommit"]>;
  files: CommitFileInfo[];
}> = ({ commit: c, files }) => {
  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
      <div
        style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}
      >
        {c.subject}
      </div>
      {c.body && (
        <div
          className="whitespace-pre-wrap"
          style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}
        >
          {c.body}
        </div>
      )}

      <div
        className="meta-grid"
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 8,
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <span className="meta-label">Commit</span>
        <span className="meta-value mono">{c.hash}</span>

        <span className="meta-label">Author</span>
        <span className="meta-value">
          {c.authorName}{" "}
          <span style={{ color: "var(--text-muted)" }}>&lt;{c.authorEmail}&gt;</span>
        </span>

        <span className="meta-label">Date</span>
        <span className="meta-value">{new Date(c.authorDate).toLocaleString()}</span>

        <span className="meta-label">Parents</span>
        <span className="meta-value mono">
          {c.parentHashes.length > 0
            ? c.parentHashes.map((h) => h.slice(0, 8)).join(" \u2192 ")
            : "\u2014"}
        </span>

        {c.refs.length > 0 && (
          <>
            <span className="meta-label">Refs</span>
            <span className="flex gap-1 flex-wrap">
              {c.refs.map((r) => (
                <span
                  key={r.name}
                  className={`badge ${
                    r.type === "head"
                      ? r.current ? "badge-head-current" : "badge-head"
                      : r.type === "remote" ? "badge-remote" : "badge-tag"
                  }`}
                >
                  {r.name}
                </span>
              ))}
            </span>
          </>
        )}

        <span className="meta-label">Stats</span>
        <span className="meta-value" style={{ display: "flex", gap: 8 }}>
          <span>{files.length} file{files.length !== 1 ? "s" : ""}</span>
          {totalAdditions > 0 && <span style={{ color: "var(--green)" }}>+{totalAdditions}</span>}
          {totalDeletions > 0 && <span style={{ color: "var(--red)" }}>-{totalDeletions}</span>}
        </span>
      </div>
    </div>
  );
};

const FilesTab: React.FC<{
  files: CommitFileInfo[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  diff: string;
}> = ({ files, selectedFile, onSelect, diff }) => {
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [blameFile, setBlameFile] = useState<string | null>(null);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
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
          <FileTree
            files={files}
            selectedFile={selectedFile}
            onSelect={onSelect}
          />
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
            <button
              onClick={() => setHistoryFile(selectedFile)}
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
              History
            </button>
            <button
              onClick={() => setBlameFile(selectedFile)}
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
              Blame
            </button>
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

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: "8px 16px",
      fontSize: 12,
      fontWeight: 500,
      background: "transparent",
      border: "none",
      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      color: active ? "var(--text-primary)" : "var(--text-muted)",
      cursor: "pointer",
      transition: "all 0.15s",
      display: "flex",
      alignItems: "center",
    }}
  >
    {children}
  </button>
);
