import React, { useEffect, useState, useCallback, useMemo } from "react";
import { DiffViewer } from "../diff/DiffViewer";
import { FileTree } from "../details/FileTree";
import { FileHistoryPanel } from "../details/FileHistoryPanel";
import { BlameView } from "../details/BlameView";
import { FileContextMenu } from "../shared/FileContextMenu";
import type { CommitFullInfo, CommitFileInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
  onNavigateToCommit?: (hash: string) => void;
  mode?: "overlay" | "window";
}

type BottomTab = "diff" | "file-tree";

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

export const CommitInfoWindow: React.FC<Props> = ({
  open,
  onClose,
  commitHash,
  onNavigateToCommit,
  mode = "overlay",
}) => {
  const [info, setInfo] = useState<CommitFullInfo | null>(null);
  const [files, setFiles] = useState<CommitFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("diff");
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [blameFile, setBlameFile] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !commitHash) return;
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setDiff("");

    Promise.all([
      window.electronAPI.log.fullInfo(commitHash),
      window.electronAPI.diff.commitFiles(commitHash),
    ])
      .then(([commitInfo, commitFiles]) => {
        setInfo(commitInfo);
        setFiles(commitFiles);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, commitHash]);

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
        .commitFile(commitHash, filePath)
        .then(setDiff)
        .catch(() => setDiff("Failed to load diff"))
        .finally(() => setDiffLoading(false));
    },
    [commitHash, selectedFile]
  );

  const handleFileSelect = useCallback(
    (filePath: string) => {
      setSelectedFile(filePath);
      setDiffLoading(true);
      window.electronAPI.diff
        .commitFile(commitHash, filePath)
        .then(setDiff)
        .catch(() => setDiff("Failed to load diff"))
        .finally(() => setDiffLoading(false));
    },
    [commitHash]
  );

  const totalAdditions = useMemo(() => files.reduce((s, f) => s + f.additions, 0), [files]);
  const totalDeletions = useMemo(() => files.reduce((s, f) => s + f.deletions, 0), [files]);

  if (!open) return null;

  const outerStyle: React.CSSProperties = mode === "window"
    ? { width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "var(--surface-1)" }
    : {
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
        animation: "ciw-fade-in 0.12s ease-out",
      };

  const innerStyle: React.CSSProperties = mode === "window"
    ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
    : {
        width: 920,
        maxWidth: "94vw",
        height: "88vh",
        maxHeight: "88vh",
        borderRadius: 12,
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
        animation: "ciw-modal-in 0.15s ease-out",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      };

  return (
    <div
      style={outerStyle}
      onClick={mode === "overlay" ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      <div
        style={innerStyle}
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
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Commit Information
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 12 }}>
            Loading commit info...
          </div>
        )}
        {error && (
          <div style={{ color: "var(--red)", fontSize: 12, padding: 16 }}>{error}</div>
        )}
        {info && !loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Top: Commit metadata */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0, overflow: "auto", maxHeight: "50%" }}>
              {/* Author row with avatar */}
              <div style={{ display: "flex", gap: 14 }}>
                {info.gravatarHash && (
                  <img
                    src={`https://www.gravatar.com/avatar/${info.gravatarHash}?s=80&d=retro`}
                    alt=""
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      flexShrink: 0,
                      border: "2px solid var(--border)",
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <MetaRow label="Author">
                    {info.authorName} &lt;{info.authorEmail}&gt;
                  </MetaRow>
                  <MetaRow label="Date">
                    {formatFullDate(info.authorDate)}
                  </MetaRow>
                  {(info.committerName !== info.authorName || info.committerEmail !== info.authorEmail) && (
                    <MetaRow label="Committer">
                      {info.committerName} &lt;{info.committerEmail}&gt;
                    </MetaRow>
                  )}
                  <MetaRow label="Commit hash">
                    <span style={{ fontFamily: "monospace", fontSize: 11, userSelect: "all" }}>
                      {info.hash}
                    </span>
                  </MetaRow>
                </div>
              </div>

              {/* Child / Parent hashes */}
              <div style={{ marginTop: 6 }}>
                {info.childHashes.length > 0 && (
                  <MetaRow label="Child">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {info.childHashes.map((ch) => (
                        <HashLink key={ch} hash={ch} onClick={onNavigateToCommit} />
                      ))}
                    </div>
                  </MetaRow>
                )}
                {info.parentHashes.length > 0 && (
                  <MetaRow label="Parent">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {info.parentHashes.map((ph) => (
                        <HashLink key={ph} hash={ph} onClick={onNavigateToCommit} />
                      ))}
                    </div>
                  </MetaRow>
                )}
              </div>

              {/* Commit message */}
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  lineHeight: 1.5,
                }}
              >
                {info.subject}
                {info.body && (
                  <div
                    style={{
                      marginTop: 6,
                      fontWeight: 400,
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {info.body}
                  </div>
                )}
              </div>

              {/* Branches, Tags, Derives */}
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <MetaRow label="Contained in branches">
                  <BadgeList items={info.containedInBranches} emptyText="No branches" color="var(--surface-2)" />
                </MetaRow>
                <MetaRow label="Contained in tags">
                  <BadgeList items={info.containedInTags} emptyText="Contained in no tag" color="var(--surface-2)" />
                </MetaRow>
                <MetaRow label="Derives from tag">
                  {info.derivesFromTag ? (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--surface-2)",
                        color: "var(--text-primary)",
                        fontFamily: "monospace",
                      }}
                    >
                      {info.derivesFromTag}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                      Derives from no tag
                    </span>
                  )}
                </MetaRow>
              </div>
            </div>

            {/* Bottom: Tabs */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Tab bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border-subtle)",
                  flexShrink: 0,
                  background: "var(--surface-0)",
                  gap: 0,
                }}
              >
                <TabButton active={bottomTab === "diff"} onClick={() => setBottomTab("diff")}>
                  Diff
                  {files.length > 0 && (
                    <span style={tabBadgeStyle}>{files.length}</span>
                  )}
                </TabButton>
                <TabButton active={bottomTab === "file-tree"} onClick={() => setBottomTab("file-tree")}>
                  File tree
                </TabButton>
                {/* Stats summary */}
                <div style={{ marginLeft: "auto", padding: "0 12px", fontSize: 11, color: "var(--text-muted)" }}>
                  {files.length} file{files.length !== 1 ? "s" : ""}
                  {totalAdditions > 0 && <span style={{ color: "var(--green)", marginLeft: 8 }}>+{totalAdditions}</span>}
                  {totalDeletions > 0 && <span style={{ color: "var(--red)", marginLeft: 4 }}>-{totalDeletions}</span>}
                </div>
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                {bottomTab === "diff" ? (
                  <DiffTab
                    files={files}
                    selectedFile={selectedFile}
                    onFileClick={handleFileClick}
                    diff={diff}
                    diffLoading={diffLoading}
                    onFileHistory={setHistoryFile}
                    onFileBlame={setBlameFile}
                  />
                ) : (
                  <FileTreeTab
                    files={files}
                    selectedFile={selectedFile}
                    onSelect={handleFileSelect}
                    diff={diff}
                    diffLoading={diffLoading}
                    onFileHistory={setHistoryFile}
                    onFileBlame={setBlameFile}
                  />
                )}
              </div>
            </div>
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
      <style>{`
        @keyframes ciw-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ciw-modal-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

/* ── Sub-components ────────────────────────────────────────────── */

const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", gap: 12, marginBottom: 4, fontSize: 12 }}>
    <span style={{ color: "var(--text-muted)", width: 140, flexShrink: 0, fontWeight: 600, textAlign: "right" }}>
      {label}:
    </span>
    <span style={{ color: "var(--text-primary)", minWidth: 0, wordBreak: "break-all" }}>
      {children}
    </span>
  </div>
);

const HashLink: React.FC<{ hash: string; onClick?: (hash: string) => void }> = ({ hash, onClick }) => (
  <span
    style={{
      color: "var(--accent)",
      cursor: onClick ? "pointer" : "default",
      textDecoration: onClick ? "underline" : "none",
      fontFamily: "monospace",
      fontSize: 11,
    }}
    onClick={() => onClick?.(hash)}
    title={hash}
  >
    {hash.slice(0, 10)}
  </span>
);

const BadgeList: React.FC<{ items: string[]; emptyText: string; color: string }> = ({ items, emptyText, color }) => {
  if (items.length === 0) {
    return <span style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{emptyText}</span>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((item) => (
        <span
          key={item}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 4,
            background: color,
            color: "var(--text-primary)",
            fontFamily: "monospace",
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

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

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      padding: "8px 14px",
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

/* ── Diff Tab: file list + inline diff (like old CommitDetailsDialog) ── */

const DiffTab: React.FC<{
  files: CommitFileInfo[];
  selectedFile: string | null;
  onFileClick: (path: string) => void;
  diff: string;
  diffLoading: boolean;
  onFileHistory?: (path: string) => void;
  onFileBlame?: (path: string) => void;
}> = ({ files, selectedFile, onFileClick, diff, diffLoading, onFileHistory, onFileBlame }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  return (
  <div style={{ height: "100%", overflow: "auto", display: "flex", flexDirection: "column" }}>
    {/* File list */}
    <div style={{ flexShrink: 0 }}>
      {files.map((file) => (
        <FileEntry
          key={file.path}
          file={file}
          selected={selectedFile === file.path}
          onClick={() => onFileClick(file.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, path: file.path });
          }}
        />
      ))}
      {files.length === 0 && (
        <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          No files changed
        </div>
      )}
    </div>

    {/* Inline diff */}
    {selectedFile && (
      <div style={{ flexShrink: 0, borderTop: "1px solid var(--border-subtle)" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary)",
            padding: "6px 12px",
            background: "var(--surface-0)",
            fontFamily: "monospace",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {selectedFile}
        </div>
        {diffLoading ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Loading diff...
          </div>
        ) : (
          <DiffViewer rawDiff={diff} showFormatToggle={false} />
        )}
      </div>
    )}
    {contextMenu && (
      <FileContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        filePath={contextMenu.path}
        onClose={() => setContextMenu(null)}
        onHistory={onFileHistory || (() => {})}
        onBlame={onFileBlame}
      />
    )}
  </div>
  );
};

const FileEntry: React.FC<{
  file: CommitFileInfo;
  selected: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ file, selected, onClick, onContextMenu }) => (
  <div
    onClick={onClick}
    onContextMenu={onContextMenu}
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
    <span style={{ flex: 1, color: "var(--text-primary)", fontFamily: "monospace", fontSize: 11, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {file.path}
    </span>
    <span style={{ fontSize: 11, flexShrink: 0, display: "flex", gap: 6 }}>
      {file.additions > 0 && <span style={{ color: "var(--green)" }}>+{file.additions}</span>}
      {file.deletions > 0 && <span style={{ color: "var(--red)" }}>-{file.deletions}</span>}
    </span>
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-muted)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, transform: selected ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </div>
);

/* ── File Tree Tab: tree view + diff pane (like CommitDetailsPanel Files tab) ── */

const FileTreeTab: React.FC<{
  files: CommitFileInfo[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
  diff: string;
  diffLoading: boolean;
  onFileHistory?: (path: string) => void;
  onFileBlame?: (path: string) => void;
}> = ({ files, selectedFile, onSelect, diff, diffLoading, onFileHistory, onFileBlame }) => (
  <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>
    <div
      style={{
        width: 260,
        minWidth: 180,
        borderRight: "1px solid var(--border-subtle)",
        overflowY: "auto",
      }}
    >
      <FileTree files={files} selectedFile={selectedFile} onSelect={onSelect} onFileHistory={onFileHistory} onFileBlame={onFileBlame} />
    </div>
    <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
      {selectedFile ? (
        diffLoading ? (
          <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Loading diff...
          </div>
        ) : (
          <DiffViewer rawDiff={diff} showFormatToggle={false} />
        )
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 12 }}>
          Select a file to view diff
        </div>
      )}
    </div>
  </div>
);

/* ── Helpers ── */

function formatFullDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    let relative = "";
    if (diffDays === 0) relative = "Today";
    else if (diffDays === 1) relative = "1 day ago";
    else if (diffDays < 30) relative = `${diffDays} days ago`;
    else if (diffDays < 365) relative = `${Math.floor(diffDays / 30)} months ago`;
    else relative = `${Math.floor(diffDays / 365)} years ago`;

    const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return `${relative} (${dateStr} ${timeStr})`;
  } catch {
    return iso;
  }
}
