import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import type { StashEntry, GitStatus } from "../../../shared/git-types";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: "overlay" | "window";
}

type ChangedFile = {
  path: string;
  status: string;
  staged: boolean;
  isUntracked?: boolean;
};

type ShowMode = "working" | "stash";

const IconClose = () => (
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
);

const IconFolder = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconFile = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const IconChevron = ({ expanded }: { expanded: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.1s" }}
  >
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

function statusColor(status: string): string {
  switch (status) {
    case "added":
      return "var(--green)";
    case "modified":
      return "var(--yellow)";
    case "deleted":
      return "var(--red)";
    case "renamed":
      return "var(--blue)";
    default:
      return "var(--text-muted)";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    default:
      return "?";
  }
}

type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
  file?: ChangedFile;
};

function buildTree(files: ChangedFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]!;
      const partPath = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;
      let node = current.find((n) => n.name === name);
      if (!node) {
        node = { name, path: partPath, children: [], file: isFile ? file : undefined };
        current.push(node);
      }
      current = node.children;
    }
  }
  return sortTree(root);
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .sort((a, b) => {
      const aIsDir = a.children.length > 0 && !a.file;
      const bIsDir = b.children.length > 0 && !b.file;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((n) => ({ ...n, children: sortTree(n.children) }));
}

export const StashDialog: React.FC<Props> = ({ open, onClose, mode = "overlay" }) => {
  const { t } = useTranslation();
  const { refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const [showMode, setShowMode] = useState<ShowMode>("working");
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedStash, setSelectedStash] = useState<number | null>(null);
  const [diff, setDiff] = useState("");
  const [message, setMessage] = useState("");
  const [keepIndex, setKeepIndex] = useState(false);
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());

  const loadWorkingChanges = useCallback(async () => {
    try {
      const status: GitStatus = await window.electronAPI.status.get();
      const all: ChangedFile[] = [];
      for (const f of status.staged) all.push({ ...f, staged: true });
      for (const f of status.unstaged) all.push({ ...f, staged: false });
      for (const p of status.untracked)
        all.push({ path: p, status: "added", staged: false, isUntracked: true });
      setFiles(all);
    } catch {
      /* ignore */
    }
  }, []);

  const loadStashes = useCallback(async () => {
    try {
      const list = await window.electronAPI.stash.list();
      setStashes(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadWorkingChanges();
    loadStashes();
    setMessage("");
    setError(null);
    setSelectedFile(null);
    setSelectedStash(null);
    setDiff("");
  }, [open, loadWorkingChanges, loadStashes]);

  const loadDiff = useCallback(async (filePath: string, file: ChangedFile) => {
    try {
      const d = await window.electronAPI.diff.file(filePath, file.staged);
      setDiff(d);
    } catch {
      setDiff("");
    }
  }, []);

  const handleSelectFile = (file: ChangedFile) => {
    setSelectedFile(file.path);
    loadDiff(file.path, file);
  };

  const afterStashAction = async () => {
    await Promise.all([loadWorkingChanges(), loadStashes(), refreshStatus(), loadGraph()]);
  };

  const handleStashAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Stash", () =>
        window.electronAPI.stash.create(message || undefined, { keepIndex, includeUntracked })
      );
      await afterStashAction();
      setMessage("");
      setDiff("");
      setSelectedFile(null);
    } catch (err) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDropStash = async () => {
    if (selectedStash === null) return;
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.stash.drop(selectedStash);
      await Promise.all([loadStashes(), loadGraph()]);
      setSelectedStash(null);
    } catch (err) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyStash = async () => {
    if (selectedStash === null) return;
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Stash Apply", () => window.electronAPI.stash.apply(selectedStash));
      await afterStashAction();
    } catch (err) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleDir = (path: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!open) return null;

  const tree = buildTree(files);

  const renderTreeNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isDir = node.children.length > 0 && !node.file;
    const expanded = !collapsedDirs.has(node.path);

    if (isDir) {
      return (
        <React.Fragment key={node.path}>
          <div
            onClick={() => toggleDir(node.path)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              paddingLeft: depth * 16 + 4,
              paddingRight: 8,
              height: 24,
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <IconChevron expanded={expanded} />
            <IconFolder />
            <span>{node.name}</span>
          </div>
          {expanded && node.children.map((c) => renderTreeNode(c, depth + 1))}
        </React.Fragment>
      );
    }

    const file = node.file!;
    const selected = selectedFile === file.path;
    return (
      <div
        key={node.path}
        onClick={() => handleSelectFile(file)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          paddingLeft: depth * 16 + 4,
          paddingRight: 8,
          height: 24,
          cursor: "pointer",
          fontSize: 12,
          background: selected ? "var(--surface-3)" : "transparent",
          color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = "transparent";
        }}
      >
        <span style={{ width: 10 }} />
        <IconFile />
        <span
          style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {node.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: statusColor(file.status),
            minWidth: 14,
            textAlign: "center",
          }}
        >
          {file.isUntracked ? "?" : statusLabel(file.status)}
        </span>
      </div>
    );
  };

  const outerStyle: React.CSSProperties =
    mode === "window"
      ? {
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface-0)",
        }
      : {
          position: "fixed",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(2px)",
          animation: "fade-in 0.12s ease-out",
        };

  const innerStyle: React.CSSProperties =
    mode === "window"
      ? { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
      : {
          width: 820,
          height: 560,
          borderRadius: 12,
          overflow: "hidden",
          background: "var(--surface-0)",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          animation: "modal-in 0.15s ease-out",
          display: "flex",
          flexDirection: "column",
        };

  return (
    <div
      style={outerStyle}
      onClick={
        mode === "overlay"
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div style={innerStyle}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
            background: "var(--surface-1)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--mauve)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {t("stash.title")}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <IconClose />
          </button>
        </div>

        {/* Show mode selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "var(--surface-1)",
            borderBottom: "1px solid var(--border-subtle)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{t("stash.show")}</span>
          <select
            value={showMode}
            onChange={(e) => {
              setShowMode(e.target.value as ShowMode);
              setDiff("");
              setError(null);
            }}
            style={{
              padding: "3px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-primary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <option value="working">{t("stash.workingDirectoryChanges")}</option>
            <option value="stash">{t("stash.stashListOption")}</option>
          </select>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left: file tree or stash list */}
          <div
            style={{
              width: 300,
              minWidth: 200,
              display: "flex",
              flexDirection: "column",
              borderRight: "1px solid var(--border-subtle)",
              background: "var(--surface-0)",
            }}
          >
            <div
              style={{
                padding: "6px 12px",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--surface-1)",
              }}
            >
              {showMode === "working"
                ? t("stash.workingDirectoryCount", {
                    count: files.length,
                    plural: files.length !== 1 ? "s" : "",
                  })
                : t("stash.stashesCount", { count: stashes.length })}
            </div>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              {showMode === "working" ? (
                files.length === 0 ? (
                  <div
                    style={{
                      padding: 16,
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    {t("stash.noChanges")}
                  </div>
                ) : (
                  tree.map((node) => renderTreeNode(node, 0))
                )
              ) : stashes.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    fontSize: 12,
                    color: "var(--text-muted)",
                    fontStyle: "italic",
                  }}
                >
                  {t("stash.noStashes")}
                </div>
              ) : (
                stashes.map((s) => (
                  <div
                    key={s.index}
                    onClick={() => setSelectedStash(s.index)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      background: selectedStash === s.index ? "var(--surface-3)" : "transparent",
                      color:
                        selectedStash === s.index ? "var(--text-primary)" : "var(--text-secondary)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedStash !== s.index)
                        e.currentTarget.style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (selectedStash !== s.index)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>stash@{"{" + s.index + "}"}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.message}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: diff viewer */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "var(--surface-0)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "auto",
                fontFamily: "var(--font-mono, 'Cascadia Code', 'Fira Code', monospace)",
                fontSize: 12,
                lineHeight: 1.5,
                padding: diff ? 0 : 16,
              }}
            >
              {diff ? (
                <DiffView diff={diff} />
              ) : (
                <span
                  style={{ color: "var(--text-muted)", fontStyle: "italic", fontFamily: "inherit" }}
                >
                  {showMode === "working" ? t("stash.selectFileDiff") : t("stash.selectStash")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: message + options + buttons */}
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--surface-1)",
            padding: "10px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* Message input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
              {t("stash.message")}
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={showMode === "working" ? t("stash.optionalMessage") : ""}
              disabled={showMode !== "working"}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--mauve)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && showMode === "working" && files.length > 0)
                  handleStashAll();
              }}
            />
          </div>

          {/* Options row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              <input
                type="checkbox"
                checked={keepIndex}
                onChange={(e) => setKeepIndex(e.target.checked)}
                disabled={showMode !== "working"}
                style={{ accentColor: "var(--mauve)" }}
              />
              {t("stash.keepIndex")}
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                color: "var(--text-secondary)",
              }}
            >
              <input
                type="checkbox"
                checked={includeUntracked}
                onChange={(e) => setIncludeUntracked(e.target.checked)}
                disabled={showMode !== "working"}
                style={{ accentColor: "var(--mauve)" }}
              />
              {t("stash.includeUntracked")}
            </label>
          </div>

          {error && (
            <div style={{ fontSize: 11, color: "var(--red)", padding: "4px 0" }}>{error}</div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {showMode === "working" ? (
              <button
                onClick={handleStashAll}
                disabled={loading || files.length === 0}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: files.length === 0 || loading ? "var(--surface-3)" : "var(--mauve)",
                  color:
                    files.length === 0 || loading ? "var(--text-muted)" : "var(--text-on-color)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: files.length === 0 || loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? t("stash.stashing") : t("stash.stashAllChanges")}
              </button>
            ) : (
              <>
                <button
                  onClick={handleApplyStash}
                  disabled={loading || selectedStash === null}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 6,
                    border: "none",
                    background:
                      selectedStash === null || loading ? "var(--surface-3)" : "var(--green)",
                    color:
                      selectedStash === null || loading
                        ? "var(--text-muted)"
                        : "var(--text-on-color)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: selectedStash === null || loading ? "not-allowed" : "pointer",
                  }}
                >
                  {t("stash.applySelected")}
                </button>
                <button
                  onClick={handleDropStash}
                  disabled={loading || selectedStash === null}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: selectedStash === null || loading ? "var(--text-muted)" : "var(--red)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: selectedStash === null || loading ? "not-allowed" : "pointer",
                  }}
                >
                  {t("stash.dropSelected")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
    </div>
  );
};

/** @deprecated Use StashDialog instead */
export const CreateStashDialog = StashDialog;

/* Simple inline diff renderer */
const DiffView: React.FC<{ diff: string }> = ({ diff }) => {
  const lines = diff.split("\n");
  return (
    <div style={{ minWidth: "fit-content" }}>
      {lines.map((line, i) => {
        let bg = "transparent";
        let color = "var(--text-secondary)";
        if (line.startsWith("+")) {
          bg = "var(--diff-add-bg, rgba(166,227,161,0.1))";
          color = "var(--green)";
        } else if (line.startsWith("-")) {
          bg = "var(--diff-del-bg, rgba(243,139,168,0.1))";
          color = "var(--red)";
        } else if (line.startsWith("@@")) {
          color = "var(--blue)";
        } else if (line.startsWith("diff") || line.startsWith("index")) {
          color = "var(--text-muted)";
        }
        return (
          <div
            key={i}
            style={{
              padding: "0 12px",
              background: bg,
              color,
              whiteSpace: "pre",
              minHeight: 20,
              lineHeight: "20px",
            }}
          >
            {line || " "}
          </div>
        );
      })}
    </div>
  );
};
