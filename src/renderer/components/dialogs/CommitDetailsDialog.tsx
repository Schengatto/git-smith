import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { CommitFullInfo, CommitFileInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
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

export const CommitDetailsDialog: React.FC<Props> = ({ open, onClose, commitHash }) => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<CommitFullInfo | null>(null);
  const [files, setFiles] = useState<CommitFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!open) return null;

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(2px)",
        animation: "fade-in 0.12s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 860,
          maxWidth: "92vw",
          maxHeight: "85vh",
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          animation: "modal-in 0.15s ease-out",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
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
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            {t("commitDetails.title")}
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

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {loading && (
            <div
              style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 12 }}
            >
              {t("commitDetails.loadingDetails")}
            </div>
          )}
          {error && <div style={{ color: "var(--red)", fontSize: 12, padding: 8 }}>{error}</div>}
          {info && !loading && (
            <>
              {/* Commit info header */}
              <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                {info.gravatarHash && (
                  <img
                    src={`https://www.gravatar.com/avatar/${info.gravatarHash}?s=80&d=retro`}
                    alt=""
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      flexShrink: 0,
                      border: "2px solid var(--border)",
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 4,
                    }}
                  >
                    {info.subject}
                  </div>
                  {info.body && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        whiteSpace: "pre-wrap",
                        marginBottom: 6,
                      }}
                    >
                      {info.body}
                    </div>
                  )}
                  <div
                    style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}
                  >
                    <span>
                      <strong style={{ color: "var(--text-secondary)" }}>{info.authorName}</strong>{" "}
                      &lt;{info.authorEmail}&gt;
                    </span>
                    <span>{formatFullDate(info.authorDate)}</span>
                    <span style={{ fontFamily: "monospace" }}>{info.abbreviatedHash}</span>
                  </div>
                  {info.parentHashes.length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      Parent:{" "}
                      {info.parentHashes.map((h) => (
                        <span
                          key={h}
                          style={{
                            fontFamily: "monospace",
                            color: "var(--accent)",
                            marginRight: 6,
                          }}
                        >
                          {h.slice(0, 10)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* File list */}
              <div
                style={{
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                  overflow: "hidden",
                }}
              >
                {/* File list header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface-0)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                    {t("commitDetails.filesChanged", {
                      count: files.length,
                      plural: files.length !== 1 ? "s" : "",
                    })}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    <span style={{ color: "var(--green)" }}>+{totalAdditions}</span>
                    {" / "}
                    <span style={{ color: "var(--red)" }}>-{totalDeletions}</span>
                  </span>
                </div>

                {/* File entries */}
                {files.map((file) => (
                  <FileEntry
                    key={file.path}
                    file={file}
                    selected={selectedFile === file.path}
                    onClick={() => handleFileClick(file.path)}
                  />
                ))}

                {files.length === 0 && !loading && (
                  <div
                    style={{
                      padding: 16,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      textAlign: "center",
                    }}
                  >
                    {t("commitDetails.noFilesChanged")}
                  </div>
                )}
              </div>

              {/* Diff viewer */}
              {selectedFile && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      padding: "8px 12px",
                      background: "var(--surface-0)",
                      borderRadius: "6px 6px 0 0",
                      border: "1px solid var(--border-subtle)",
                      borderBottom: "none",
                      fontFamily: "monospace",
                    }}
                  >
                    {selectedFile}
                  </div>
                  <div
                    style={{
                      borderRadius: "0 0 6px 6px",
                      border: "1px solid var(--border-subtle)",
                      overflow: "auto",
                      maxHeight: 400,
                    }}
                  >
                    {diffLoading ? (
                      <div
                        style={{
                          padding: 16,
                          fontSize: 12,
                          color: "var(--text-muted)",
                          textAlign: "center",
                        }}
                      >
                        {t("commitDetails.loadingDiff")}
                      </div>
                    ) : (
                      <DiffViewer diff={diff} />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

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
    {/* Status badge */}
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
    {/* File path */}
    <span
      style={{
        flex: 1,
        color: "var(--text-primary)",
        fontFamily: "monospace",
        fontSize: 11,
        minWidth: 0,
      }}
      className="truncate"
    >
      {file.path}
    </span>
    {/* Stats */}
    <span style={{ fontSize: 11, flexShrink: 0, display: "flex", gap: 6 }}>
      {file.additions > 0 && <span style={{ color: "var(--green)" }}>+{file.additions}</span>}
      {file.deletions > 0 && <span style={{ color: "var(--red)" }}>-{file.deletions}</span>}
    </span>
    {/* Expand indicator */}
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-muted)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        flexShrink: 0,
        transform: selected ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.15s",
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  </div>
);

const DiffViewer: React.FC<{ diff: string }> = ({ diff }) => {
  const { t } = useTranslation();
  if (!diff) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
        {t("commitDetails.noDiffAvailable")}
      </div>
    );
  }

  const lines = diff.split("\n");

  return (
    <pre
      style={{
        margin: 0,
        padding: 0,
        fontSize: 11,
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
        lineHeight: 1.6,
        overflowX: "auto",
      }}
    >
      {lines.map((line, i) => {
        let bg = "transparent";
        let color = "var(--text-primary)";

        if (line.startsWith("+++") || line.startsWith("---")) {
          color = "var(--text-muted)";
          bg = "var(--surface-0)";
        } else if (line.startsWith("@@")) {
          color = "var(--accent)";
          bg = "color-mix(in srgb, var(--accent) 8%, transparent)";
        } else if (line.startsWith("+")) {
          color = "var(--green)";
          bg = "color-mix(in srgb, var(--green) 10%, transparent)";
        } else if (line.startsWith("-")) {
          color = "var(--red)";
          bg = "color-mix(in srgb, var(--red) 10%, transparent)";
        } else if (line.startsWith("diff ") || line.startsWith("index ")) {
          color = "var(--text-muted)";
        }

        return (
          <div
            key={i}
            style={{
              padding: "0 12px",
              background: bg,
              color,
              minHeight: 18,
              whiteSpace: "pre",
            }}
          >
            {line}
          </div>
        );
      })}
    </pre>
  );
};

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

    const dateStr = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `${relative} (${dateStr} ${timeStr})`;
  } catch {
    return iso;
  }
}
