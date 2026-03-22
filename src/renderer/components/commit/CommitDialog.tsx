import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { useUIStore } from "../../store/ui-store";
import { HunkStagingView } from "./HunkStagingView";
import {
  runGitOperation,
  useGitOperationStore,
  GitOperationCancelledError,
} from "../../store/git-operation-store";
import { SetUpstreamDialog } from "../dialogs/SetUpstreamDialog";
import { openDialogWindow } from "../../utils/open-dialog";
import { FileHistoryPanel } from "../details/FileHistoryPanel";
import { BlameView } from "../details/BlameView";
import type { GitStatus, ConflictFile } from "../../../shared/git-types";
import type { CommitTemplate, CommitSnippet } from "../../../shared/settings-types";
import { AiCommitMessageButton } from "../ai/AiCommitMessageButton";
import { useAccountStore } from "../../store/account-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

type ChangedFile = {
  path: string;
  status: string;
  staged: boolean;
  isUntracked?: boolean;
};

type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
  file?: ChangedFile;
  expanded?: boolean;
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
        node = {
          name,
          path: partPath,
          children: [],
          file: isFile ? file : undefined,
          expanded: true,
        };
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

export const CommitDialog: React.FC<Props> = ({ open, onClose }) => {
  const { repo, refreshStatus, refreshInfo } = useRepoStore();
  const { loadGraph } = useGraphStore();
  const showToast = useUIStore((s) => s.showToast);

  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileStaged, setSelectedFileStaged] = useState(false);
  const [diff, setDiff] = useState<string>("");
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeView, setTreeView] = useState(true);
  const [commitDropdownOpen, setCommitDropdownOpen] = useState(false);
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set());
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set());
  const commitDropdownRef = useRef<HTMLDivElement>(null);

  // Commit message dropdown
  const [recentMessages, setRecentMessages] = useState<string[]>([]);
  const [messageDropdownOpen, setMessageDropdownOpen] = useState(false);
  const messageDropdownRef = useRef<HTMLDivElement>(null);

  // Commit templates dropdown
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const [commitTemplates, setCommitTemplates] = useState<CommitTemplate[]>([]);

  // Commit snippets
  const [snippetDropdownOpen, setSnippetDropdownOpen] = useState(false);
  const snippetDropdownRef = useRef<HTMLDivElement>(null);
  const [commitSnippets, setCommitSnippets] = useState<CommitSnippet[]>([]);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Create branch
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [checkoutAfterCreate, setCheckoutAfterCreate] = useState(true);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  // Set upstream dialog (when push fails because no upstream)
  const [setUpstreamError, setSetUpstreamError] = useState<{
    suggestedRemote: string;
    suggestedBranch: string;
  } | null>(null);

  // File history / blame
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [blameFile, setBlameFile] = useState<string | null>(null);

  // Merge conflict state
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [conflictedFiles, setConflictedFiles] = useState<ConflictFile[]>([]);

  const loadFiles = useCallback(async () => {
    try {
      const status: GitStatus = await window.electronAPI.status.get();
      const all = statusToFiles(status);
      setFiles(all);
      setMergeInProgress(status.mergeInProgress);
      setConflictedFiles(status.conflicted);
      setSelectedFile((prev) => {
        if (!prev && all.length > 0) return all[0]!.path;
        return prev;
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      loadFiles();
      setMessage("");
      setAmend(false);
      setError(null);
      setSelectedUnstaged(new Set());
      setSelectedStaged(new Set());
      setCreateBranchOpen(false);
      setNewBranchName("");
      setBranchError(null);
      // Load recent commit messages
      window.electronAPI.commit
        .getRecentMessages()
        .then(setRecentMessages)
        .catch(() => {
          /* non-critical — recent messages are optional */
        });
      // Load commit templates and snippets from settings
      window.electronAPI.settings
        .get()
        .then((s) => {
          if (s.commitTemplates && s.commitTemplates.length > 0)
            setCommitTemplates(s.commitTemplates);
          if (s.commitSnippets && s.commitSnippets.length > 0) setCommitSnippets(s.commitSnippets);
        })
        .catch(() => {
          /* non-critical — defaults are fine */
        });
    }
  }, [open, loadFiles]);

  useEffect(() => {
    if (!selectedFile || !open) {
      setDiff("");
      return;
    }
    const file = files.find((f) => f.path === selectedFile && f.staged === selectedFileStaged);
    if (!file) return;

    const loadDiff = async () => {
      try {
        if (file.isUntracked) {
          setDiff("(New untracked file)");
        } else {
          const d = await window.electronAPI.diff.file(selectedFile, selectedFileStaged);
          setDiff(d || "(No diff available)");
        }
      } catch {
        setDiff("(Could not load diff)");
      }
    };
    loadDiff();
  }, [selectedFile, selectedFileStaged, files, open]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (commitDropdownRef.current && !commitDropdownRef.current.contains(e.target as Node)) {
        setCommitDropdownOpen(false);
      }
      if (messageDropdownRef.current && !messageDropdownRef.current.contains(e.target as Node)) {
        setMessageDropdownOpen(false);
      }
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
        setTemplateDropdownOpen(false);
      }
      if (snippetDropdownRef.current && !snippetDropdownRef.current.contains(e.target as Node)) {
        setSnippetDropdownOpen(false);
      }
    };
    if (commitDropdownOpen || messageDropdownOpen || templateDropdownOpen || snippetDropdownOpen) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [commitDropdownOpen, messageDropdownOpen, templateDropdownOpen, snippetDropdownOpen]);

  const statusToFiles = (status: GitStatus): ChangedFile[] => {
    const all: ChangedFile[] = [];
    const conflictedPaths = new Set(status.conflicted.map((c) => c.path));
    for (const f of status.staged) {
      if (!conflictedPaths.has(f.path)) all.push({ path: f.path, status: f.status, staged: true });
    }
    for (const f of status.unstaged) {
      if (!conflictedPaths.has(f.path)) all.push({ path: f.path, status: f.status, staged: false });
    }
    for (const p of status.untracked)
      all.push({ path: p, status: "untracked", staged: false, isUntracked: true });
    // Show conflicted files in the unstaged section with "conflicted" status
    for (const c of status.conflicted)
      all.push({ path: c.path, status: "conflicted", staged: false });
    return all;
  };

  const stageFiles = async (paths: string[]) => {
    // Don't try to stage conflicted files - they must be resolved first
    const conflictedPaths = new Set(conflictedFiles.map((c) => c.path));
    const safePaths = paths.filter((p) => !conflictedPaths.has(p));
    if (safePaths.length === 0) return;
    try {
      const status = await window.electronAPI.status.stage(safePaths);
      setFiles(statusToFiles(status));
      setMergeInProgress(status.mergeInProgress);
      setConflictedFiles(status.conflicted);
      setSelectedUnstaged(new Set());
    } catch (err: unknown) {
      showToast(`Stage failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const unstageFiles = async (paths: string[]) => {
    try {
      const status = await window.electronAPI.status.unstage(paths);
      setFiles(statusToFiles(status));
      setSelectedStaged(new Set());
    } catch (err: unknown) {
      showToast(`Unstage failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const stageAll = async () => {
    const allPaths = files.filter((f) => !f.staged).map((f) => f.path);
    if (allPaths.length === 0) return;
    try {
      const status = await window.electronAPI.status.stage(allPaths);
      setFiles(statusToFiles(status));
      setSelectedUnstaged(new Set());
    } catch (err: unknown) {
      showToast(`Stage all failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const unstageAll = async () => {
    const allPaths = files.filter((f) => f.staged).map((f) => f.path);
    if (allPaths.length === 0) return;
    try {
      const status = await window.electronAPI.status.unstage(allPaths);
      setFiles(statusToFiles(status));
      setSelectedStaged(new Set());
    } catch (err: unknown) {
      showToast(`Unstage all failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDiscard = async (paths: string[]) => {
    try {
      await window.electronAPI.status.discard(paths);
      if (selectedFile && paths.includes(selectedFile)) {
        setSelectedFile(null);
        setDiff("");
      }
      await loadFiles();
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDiscardAll = async () => {
    try {
      await window.electronAPI.status.discardAll();
      setSelectedFile(null);
      setDiff("");
      await loadFiles();
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleAddToGitignore = async (pattern: string) => {
    try {
      await window.electronAPI.gitignore.add(pattern);
      await loadFiles();
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleStageHunk = async (patch: string) => {
    try {
      await window.electronAPI.status.stageLines(patch);
      await loadFiles();
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUnstageHunk = async (patch: string) => {
    try {
      await window.electronAPI.status.unstageLines(patch);
      await loadFiles();
      await refreshStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  const handleCommit = async (andPush = false) => {
    if (!message.trim() || stagedFiles.length === 0) return;
    setCommitting(true);
    setError(null);
    setCommitDropdownOpen(false);
    try {
      // Unstage any files the user moved to the unstaged list
      const toUnstage = unstagedFiles.filter((f) => !f.isUntracked).map((f) => f.path);
      if (toUnstage.length > 0) {
        await window.electronAPI.status.unstage(toUnstage);
      }

      await runGitOperation(amend ? "Amend" : "Commit", async () => {
        if (amend) {
          await window.electronAPI.commit.amend(message.trim());
        } else {
          await window.electronAPI.commit.create(message.trim());
        }
      });

      if (andPush) {
        try {
          await runGitOperation("Push", () => window.electronAPI.remote.push());
        } catch (pushErr: unknown) {
          const pushMsg = pushErr instanceof Error ? pushErr.message : String(pushErr);
          if (pushMsg.includes("has no upstream branch")) {
            const match = pushMsg.match(/git push --set-upstream (\S+) (\S+)/);
            useGitOperationStore.getState().close();
            setSetUpstreamError({
              suggestedRemote: match?.[1] ?? "origin",
              suggestedBranch: match?.[2] ?? repo?.currentBranch ?? "",
            });
          } else {
            setError(`Committed but push failed: ${pushMsg}`);
          }
          await Promise.all([refreshStatus(), refreshInfo(), loadGraph()]);
          setCommitting(false);
          return;
        }
      }

      await Promise.all([refreshStatus(), refreshInfo(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCommitting(false);
    }
  };

  const handleStash = async () => {
    setCommitDropdownOpen(false);
    try {
      await runGitOperation("Stash", () => window.electronAPI.stash.create());
      await Promise.all([loadFiles(), refreshStatus(), loadGraph()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResetAll = async () => {
    setCommitDropdownOpen(false);
    await handleDiscardAll();
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setCreatingBranch(true);
    setBranchError(null);
    try {
      await window.electronAPI.branch.create(newBranchName.trim());
      if (checkoutAfterCreate) {
        await runGitOperation("Checkout", () =>
          window.electronAPI.branch.checkout(newBranchName.trim())
        );
        await refreshInfo();
      }
      setCreateBranchOpen(false);
      setNewBranchName("");
    } catch (err: unknown) {
      setBranchError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingBranch(false);
    }
  };

  const applyTemplate = useCallback((tpl: CommitTemplate) => {
    setMessage((prev) => {
      const prefix = tpl.prefix || "";
      const body = tpl.body || "";
      if (prev.match(/^[a-z]+(\(.+\))?:/)) {
        return prev.replace(/^[a-z]+(\(.+\))?:/, prefix.replace(/\s+$/, ""));
      }
      return body ? `${prefix}${prev}\n\n${body}` : `${prefix}${prev}`;
    });
    setTemplateDropdownOpen(false);
  }, []);

  if (!open) return null;

  const canCommit = !committing && message.trim() && stagedFiles.length > 0;

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "92vw",
          maxWidth: 1200,
          height: "85vh",
          maxHeight: 800,
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
            padding: "10px 16px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <IconGitCommit />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
              }}
            >
              Commit to {repo?.currentBranch || "HEAD"}
            </span>
            {repo?.path && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                ({repo.path})
              </span>
            )}
          </div>
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

        {/* Merge conflict banner */}
        {mergeInProgress && conflictedFiles.length > 0 && (
          <div
            style={{
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(var(--red-rgb, 210, 80, 80), 0.12)",
              borderBottom: "1px solid var(--red)",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--red)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 600, flex: 1 }}>
              Merge in progress — {conflictedFiles.length} conflicted file
              {conflictedFiles.length !== 1 ? "s" : ""} to resolve
            </span>
            <button
              onClick={() => openDialogWindow({ dialog: "MergeConflictDialog" })}
              style={{
                padding: "4px 12px",
                borderRadius: 5,
                border: "1px solid var(--red)",
                background: "var(--red)",
                color: "var(--text-on-color)",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Resolve Conflicts
            </button>
          </div>
        )}

        {/* Main content: left file panels + right diff/commit */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Left: file lists with stage/unstage controls */}
          <div
            style={{
              width: 320,
              minWidth: 260,
              borderRight: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Unstaged / Changes section */}
            <FileListPanel
              title="Changes"
              count={unstagedFiles.length}
              files={unstagedFiles}
              selectedFile={selectedFileStaged ? null : selectedFile}
              selectedPaths={selectedUnstaged}
              onSelectFile={(path) => {
                setSelectedFile(path);
                setSelectedFileStaged(false);
              }}
              onToggleSelect={(path) => {
                setSelectedUnstaged((prev) => {
                  const next = new Set(prev);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return next;
                });
              }}
              accentColor="var(--peach)"
              treeView={treeView}
              onToggleTreeView={() => setTreeView((v) => !v)}
              onDiscard={handleDiscard}
              onDiscardAll={handleDiscardAll}
              showDiscard={true}
              onStageFile={(p) => stageFiles([p])}
              onAddToGitignore={handleAddToGitignore}
              onFileHistory={setHistoryFile}
              onFileBlame={setBlameFile}
              onDropFiles={(paths) => unstageFiles(paths)}
            />

            {/* Stage / Unstage action buttons */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "3px 8px",
                borderTop: "1px solid var(--border-subtle)",
                borderBottom: "1px solid var(--border-subtle)",
                background: "var(--surface-0)",
                flexShrink: 0,
              }}
            >
              <StageIconButton
                title="Stage selected"
                disabled={selectedUnstaged.size === 0}
                onClick={() => stageFiles(Array.from(selectedUnstaged))}
              >
                <IconArrowDown size={14} />
              </StageIconButton>
              <StageIconButton
                title="Stage all"
                disabled={unstagedFiles.length === 0}
                onClick={stageAll}
              >
                <IconDoubleArrowDown size={14} />
              </StageIconButton>
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: "var(--border-subtle)",
                  margin: "0 3px",
                }}
              />
              <StageIconButton
                title="Unstage selected"
                disabled={selectedStaged.size === 0}
                onClick={() => unstageFiles(Array.from(selectedStaged))}
              >
                <IconArrowUp size={14} />
              </StageIconButton>
              <StageIconButton
                title="Unstage all"
                disabled={stagedFiles.length === 0}
                onClick={unstageAll}
              >
                <IconDoubleArrowUp size={14} />
              </StageIconButton>
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: "var(--border-subtle)",
                  margin: "0 3px",
                }}
              />
              <StageIconButton title="Refresh file list" disabled={false} onClick={loadFiles}>
                <IconRefresh size={14} />
              </StageIconButton>
            </div>

            {/* Staged section */}
            <FileListPanel
              title="Staged"
              count={stagedFiles.length}
              files={stagedFiles}
              selectedFile={selectedFileStaged ? selectedFile : null}
              selectedPaths={selectedStaged}
              onSelectFile={(path) => {
                setSelectedFile(path);
                setSelectedFileStaged(true);
              }}
              onToggleSelect={(path) => {
                setSelectedStaged((prev) => {
                  const next = new Set(prev);
                  if (next.has(path)) next.delete(path);
                  else next.add(path);
                  return next;
                });
              }}
              accentColor="var(--green)"
              treeView={treeView}
              onToggleTreeView={() => setTreeView((v) => !v)}
              onDiscard={handleDiscard}
              onDiscardAll={handleDiscardAll}
              showDiscard={false}
              onUnstageFile={(p) => unstageFiles([p])}
              onAddToGitignore={handleAddToGitignore}
              onFileHistory={setHistoryFile}
              onFileBlame={setBlameFile}
              onDropFiles={(paths) => stageFiles(paths)}
            />
          </div>

          {/* Right: diff view (top) + commit message (bottom) */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Diff area */}
            <div style={{ flex: 1, overflow: "auto", background: "var(--surface-0)" }}>
              {selectedFile && diff ? (
                <HunkStagingView
                  rawDiff={diff}
                  fileName={selectedFile}
                  isStaged={selectedFileStaged}
                  isConflicted={
                    files.find((f) => f.path === selectedFile && f.staged === selectedFileStaged)
                      ?.status === "conflicted"
                  }
                  onStageHunk={handleStageHunk}
                  onUnstageHunk={handleUnstageHunk}
                />
              ) : (
                <div className="empty-state" style={{ height: "100%" }}>
                  <span>
                    {selectedFile ? diff || "Loading..." : "Select a file to view changes"}
                  </span>
                </div>
              )}
            </div>

            {/* Commit message area */}
            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flexShrink: 0,
              }}
            >
              {/* Toolbar: Commit message, Commit templates, Create branch */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {/* Commit message dropdown */}
                <div ref={messageDropdownRef} style={{ position: "relative" }}>
                  <ToolbarButton
                    label="Commit message"
                    hasDropdown
                    onClick={() => {
                      setMessageDropdownOpen((v) => !v);
                      setTemplateDropdownOpen(false);
                    }}
                    icon={<IconHistory size={12} />}
                  />
                  {messageDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: 0,
                        minWidth: 340,
                        maxWidth: 500,
                        maxHeight: 250,
                        overflowY: "auto",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        zIndex: 10,
                      }}
                    >
                      {recentMessages.length === 0 ? (
                        <div
                          style={{
                            padding: "10px 14px",
                            fontSize: 11,
                            color: "var(--text-muted)",
                          }}
                        >
                          No recent commit messages
                        </div>
                      ) : (
                        recentMessages.slice(0, 5).map((msg, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              setMessage(msg);
                              setMessageDropdownOpen(false);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "7px 14px",
                              border: "none",
                              background: "transparent",
                              color: "var(--text-primary)",
                              fontSize: 11,
                              cursor: "pointer",
                              textAlign: "left",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              transition: "background 0.08s",
                            }}
                            title={msg}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "var(--surface-hover)")
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {msg}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Commit templates dropdown */}
                <div ref={templateDropdownRef} style={{ position: "relative" }}>
                  <ToolbarButton
                    label="Commit templates"
                    hasDropdown
                    onClick={() => {
                      setTemplateDropdownOpen((v) => !v);
                      setMessageDropdownOpen(false);
                    }}
                    icon={<IconTemplate size={12} />}
                  />
                  {templateDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: 0,
                        minWidth: 280,
                        maxHeight: 320,
                        overflowY: "auto",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        zIndex: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 12px",
                          fontSize: 10,
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Commit Templates
                      </div>
                      {commitTemplates.length === 0 ? (
                        <div
                          style={{
                            padding: "10px 14px",
                            fontSize: 11,
                            color: "var(--text-muted)",
                          }}
                        >
                          No templates configured
                        </div>
                      ) : (
                        commitTemplates.map((tpl) => (
                          <button
                            key={tpl.name}
                            onClick={() => applyTemplate(tpl)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              width: "100%",
                              padding: "6px 14px",
                              border: "none",
                              background: "transparent",
                              color: "var(--text-primary)",
                              fontSize: 11,
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "background 0.08s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "var(--surface-hover)")
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <span style={{ fontWeight: 600, minWidth: 60 }}>{tpl.name}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                              {tpl.description}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Commit snippets dropdown */}
                <div ref={snippetDropdownRef} style={{ position: "relative" }}>
                  <ToolbarButton
                    label="Snippets"
                    hasDropdown
                    onClick={() => {
                      setSnippetDropdownOpen((v) => !v);
                      setMessageDropdownOpen(false);
                      setTemplateDropdownOpen(false);
                    }}
                    icon={<IconSnippet size={12} />}
                  />
                  {snippetDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: 0,
                        minWidth: 220,
                        maxHeight: 280,
                        overflowY: "auto",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        zIndex: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: "6px 12px",
                          fontSize: 10,
                          color: "var(--text-muted)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Snippets
                      </div>
                      {commitSnippets.length === 0 ? (
                        <div
                          style={{
                            padding: "10px 14px",
                            fontSize: 11,
                            color: "var(--text-muted)",
                          }}
                        >
                          No snippets configured
                        </div>
                      ) : (
                        commitSnippets.map((snip) => (
                          <button
                            key={snip.label}
                            onClick={() => {
                              const textarea = messageTextareaRef.current;
                              if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const newMsg =
                                  message.slice(0, start) + snip.text + message.slice(end);
                                setMessage(newMsg);
                                setTimeout(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(
                                    start + snip.text.length,
                                    start + snip.text.length
                                  );
                                }, 0);
                              } else {
                                setMessage((prev) => prev + snip.text);
                              }
                              setSnippetDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              width: "100%",
                              padding: "6px 14px",
                              border: "none",
                              background: "transparent",
                              color: "var(--text-primary)",
                              fontSize: 11,
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "background 0.08s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "var(--surface-hover)")
                            }
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <span style={{ fontWeight: 600 }}>{snip.label}</span>
                            <span
                              style={{
                                color: "var(--text-muted)",
                                fontSize: 10,
                                fontFamily: "var(--font-mono, monospace)",
                              }}
                            >
                              {snip.text}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Create branch button */}
                <ToolbarButton
                  label="Create branch"
                  onClick={() => setCreateBranchOpen((v) => !v)}
                  icon={<IconBranch size={12} />}
                  active={createBranchOpen}
                />
              </div>

              {/* Create Branch inline panel */}
              {createBranchOpen && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-0)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        minWidth: 80,
                        flexShrink: 0,
                      }}
                    >
                      Branch name
                    </label>
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="new-branch-name"
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        borderRadius: 5,
                        border: "1px solid var(--border)",
                        background: "var(--surface-1)",
                        color: "var(--text-primary)",
                        fontSize: 11,
                        outline: "none",
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateBranch();
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        minWidth: 80,
                        flexShrink: 0,
                      }}
                    >
                      From
                    </label>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {repo?.currentBranch || "HEAD"} ({repo?.headCommit?.slice(0, 7) || "---"})
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ minWidth: 80 }} />
                    <label
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checkoutAfterCreate}
                        onChange={(e) => setCheckoutAfterCreate(e.target.checked)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      Checkout after create
                    </label>
                  </div>
                  {branchError && (
                    <div style={{ fontSize: 10, color: "var(--red)", paddingLeft: 88 }}>
                      {branchError}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    <button
                      onClick={() => {
                        setCreateBranchOpen(false);
                        setBranchError(null);
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text-secondary)",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateBranch}
                      disabled={!newBranchName.trim() || creatingBranch}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "none",
                        background:
                          newBranchName.trim() && !creatingBranch
                            ? "var(--accent)"
                            : "var(--surface-3)",
                        color:
                          newBranchName.trim() && !creatingBranch
                            ? "var(--text-on-color)"
                            : "var(--text-muted)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: newBranchName.trim() && !creatingBranch ? "pointer" : "not-allowed",
                      }}
                    >
                      {creatingBranch ? "Creating..." : "Create branch"}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                <textarea
                  ref={messageTextareaRef}
                  placeholder="Enter commit message..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface-0)",
                    color: "var(--text-primary)",
                    fontSize: 12,
                    fontFamily: "inherit",
                    outline: "none",
                    lineHeight: 1.5,
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      handleCommit();
                    }
                  }}
                />
                <AiCommitMessageButton onGenerated={(msg) => setMessage(msg)} />
              </div>

              <AuthorInfo />

              {error && (
                <div style={{ fontSize: 11, color: "var(--red)", padding: "0 2px" }}>{error}</div>
              )}

              {/* Bottom bar: commit actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Commit button with dropdown */}
                <div ref={commitDropdownRef} style={{ position: "relative" }}>
                  <div style={{ display: "flex" }}>
                    <button
                      onClick={() => handleCommit(false)}
                      disabled={!canCommit}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px 0 0 6px",
                        border: "none",
                        background: canCommit ? "var(--accent)" : "var(--surface-3)",
                        color: canCommit ? "var(--text-on-color)" : "var(--text-muted)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: canCommit ? "pointer" : "not-allowed",
                        transition: "all 0.15s",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <IconCheck size={12} />
                      {committing ? "Committing..." : "Commit"}
                    </button>
                    <button
                      onClick={() => setCommitDropdownOpen((v) => !v)}
                      style={{
                        padding: "6px 6px",
                        borderRadius: "0 6px 6px 0",
                        border: "none",
                        borderLeft: `1px solid ${canCommit ? "var(--overlay-dim)" : "var(--border)"}`,
                        background: canCommit ? "var(--accent)" : "var(--surface-3)",
                        color: canCommit ? "var(--text-on-color)" : "var(--text-muted)",
                        fontSize: 10,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        transition: "all 0.15s",
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>

                  {commitDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: 0,
                        minWidth: 180,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        zIndex: 10,
                        overflow: "hidden",
                      }}
                    >
                      <DropdownItem
                        icon={<IconCheck size={12} />}
                        label="Commit"
                        disabled={!canCommit}
                        onClick={() => handleCommit(false)}
                      />
                      <DropdownItem
                        icon={<IconArrowUp size={12} />}
                        label="Commit & push"
                        disabled={!canCommit}
                        onClick={() => handleCommit(true)}
                      />
                      <div
                        style={{
                          height: 1,
                          background: "var(--border-subtle)",
                          margin: "2px 0",
                        }}
                      />
                      <DropdownItem
                        icon={<IconAmend size={12} />}
                        label={amend ? "Disable amend" : "Amend commit"}
                        onClick={() => {
                          setAmend((v) => !v);
                          setCommitDropdownOpen(false);
                        }}
                        active={amend}
                      />
                      <div
                        style={{
                          height: 1,
                          background: "var(--border-subtle)",
                          margin: "2px 0",
                        }}
                      />
                      <DropdownItem
                        icon={<IconStash size={12} />}
                        label="Stash staged changes"
                        onClick={handleStash}
                      />
                      <DropdownItem
                        icon={<IconDiscard size={12} />}
                        label="Reset all changes"
                        danger
                        onClick={handleResetAll}
                      />
                    </div>
                  )}
                </div>

                {amend && (
                  <span style={{ fontSize: 11, color: "var(--yellow)", fontWeight: 500 }}>
                    Amend mode
                  </span>
                )}

                <div style={{ flex: 1 }} />

                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  {stagedFiles.length}/{files.length} staged
                </span>

                <button
                  onClick={onClose}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div
          style={{
            padding: "4px 14px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 10,
            color: "var(--text-muted)",
            background: "var(--surface-0)",
            flexShrink: 0,
          }}
        >
          <span>Ctrl+Enter to commit</span>
          <div style={{ flex: 1 }} />
          <span>
            Staged {stagedFiles.length}/{files.length}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modal-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>

      <SetUpstreamDialog
        open={!!setUpstreamError}
        onClose={() => setSetUpstreamError(null)}
        suggestedRemote={setUpstreamError?.suggestedRemote ?? "origin"}
        suggestedBranch={setUpstreamError?.suggestedBranch ?? ""}
      />

      <FileHistoryPanel
        open={!!historyFile}
        onClose={() => setHistoryFile(null)}
        filePath={historyFile || ""}
      />
      <BlameView open={!!blameFile} onClose={() => setBlameFile(null)} filePath={blameFile || ""} />
    </div>
  );
};

/* ─── File List Panel (used for both Staged and Changes) ─── */

const FileListPanel: React.FC<{
  title: string;
  count: number;
  files: ChangedFile[];
  selectedFile: string | null;
  selectedPaths: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleSelect: (path: string) => void;
  accentColor: string;
  treeView: boolean;
  onToggleTreeView: () => void;
  onDiscard: (paths: string[]) => void;
  onDiscardAll: () => void;
  showDiscard: boolean;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onAddToGitignore: (pattern: string) => void;
  onFileHistory?: (path: string) => void;
  onFileBlame?: (path: string) => void;
  onDropFiles?: (paths: string[]) => void;
}> = ({
  title,
  count,
  files,
  selectedFile,
  selectedPaths,
  onSelectFile,
  onToggleSelect,
  accentColor,
  treeView,
  onToggleTreeView,
  onDiscard,
  onDiscardAll,
  showDiscard,
  onStageFile,
  onUnstageFile,
  onAddToGitignore,
  onFileHistory,
  onFileBlame,
  onDropFiles,
}) => {
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const tree = useMemo(() => buildTree(files), [files]);

  const toggleDir = (dirPath: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Section header */}
      <div
        style={{
          padding: "5px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: "var(--surface-0)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: accentColor,
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: "0 5px",
              lineHeight: "15px",
              borderRadius: 7,
              background: count > 0 ? accentColor : "var(--surface-3)",
              color: count > 0 ? "var(--text-on-color)" : "var(--text-muted)",
              display: "inline-block",
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {count}
          </span>
        </div>
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {showDiscard &&
            files.length > 0 &&
            (confirmDiscardAll ? (
              <span style={{ display: "flex", gap: 3, alignItems: "center", fontSize: 10 }}>
                <span style={{ color: "var(--red)" }}>Discard all?</span>
                <button
                  onClick={() => {
                    onDiscardAll();
                    setConfirmDiscardAll(false);
                  }}
                  style={{
                    fontSize: 9,
                    color: "var(--red)",
                    background: "var(--red-dim)",
                    border: "none",
                    cursor: "pointer",
                    padding: "1px 5px",
                    borderRadius: 3,
                    fontWeight: 600,
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDiscardAll(false)}
                  style={{
                    fontSize: 9,
                    color: "var(--text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "1px 3px",
                  }}
                >
                  No
                </button>
              </span>
            ) : (
              <IconButton title="Discard all changes" onClick={() => setConfirmDiscardAll(true)}>
                <IconDiscard size={11} />
              </IconButton>
            ))}
          <IconButton
            title={treeView ? "Switch to flat view" : "Switch to tree view"}
            onClick={onToggleTreeView}
            active={treeView}
          >
            {treeView ? <IconTree size={12} /> : <IconList size={12} />}
          </IconButton>
        </div>
      </div>

      {/* File list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          outline: dragOver ? "2px dashed var(--accent)" : "none",
          outlineOffset: -2,
          transition: "outline 0.1s",
        }}
        onDragOver={
          onDropFiles
            ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOver(true);
              }
            : undefined
        }
        onDragLeave={onDropFiles ? () => setDragOver(false) : undefined}
        onDrop={
          onDropFiles
            ? (e) => {
                e.preventDefault();
                setDragOver(false);
                const data = e.dataTransfer.getData("application/git-expansion-files");
                if (data) onDropFiles(JSON.parse(data));
              }
            : undefined
        }
      >
        {files.length === 0 && (
          <div
            style={{
              padding: "12px",
              fontSize: 11,
              color: "var(--text-muted)",
              textAlign: "center",
            }}
          >
            No files
          </div>
        )}
        {treeView
          ? tree.map((node) => (
              <TreeNodeRow
                key={node.path}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                selectedPaths={selectedPaths}
                onSelectFile={onSelectFile}
                onToggleSelect={onToggleSelect}
                collapsedDirs={collapsedDirs}
                onToggleDir={toggleDir}
                showDiscard={showDiscard}
                onDiscard={onDiscard}
                onStageFile={onStageFile}
                onUnstageFile={onUnstageFile}
                onAddToGitignore={onAddToGitignore}
                onFileHistory={onFileHistory}
                onFileBlame={onFileBlame}
              />
            ))
          : files.map((f) => (
              <FlatFileRow
                key={f.path}
                file={f}
                selected={f.path === selectedFile}
                checked={selectedPaths.has(f.path)}
                onSelect={() => onSelectFile(f.path)}
                onToggleCheck={() => onToggleSelect(f.path)}
                showDiscard={showDiscard}
                onDiscard={() => onDiscard([f.path])}
                onStage={onStageFile ? () => onStageFile(f.path) : undefined}
                onUnstage={onUnstageFile ? () => onUnstageFile(f.path) : undefined}
                onAddToGitignore={onAddToGitignore}
                onFileHistory={onFileHistory}
                onFileBlame={onFileBlame}
                dragPaths={
                  selectedPaths.has(f.path) && selectedPaths.size > 1
                    ? Array.from(selectedPaths)
                    : undefined
                }
              />
            ))}
      </div>
    </div>
  );
};

/* ─── Tree Node Row ─── */

const TreeNodeRow: React.FC<{
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  selectedPaths: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleSelect: (path: string) => void;
  collapsedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  showDiscard: boolean;
  onDiscard: (paths: string[]) => void;
  onStageFile?: (path: string) => void;
  onUnstageFile?: (path: string) => void;
  onAddToGitignore: (pattern: string) => void;
  onFileHistory?: (path: string) => void;
  onFileBlame?: (path: string) => void;
}> = ({
  node,
  depth,
  selectedFile,
  selectedPaths,
  onSelectFile,
  onToggleSelect,
  collapsedDirs,
  onToggleDir,
  showDiscard,
  onDiscard,
  onStageFile,
  onUnstageFile,
  onAddToGitignore,
  onFileHistory,
  onFileBlame,
}) => {
  const isDir = !node.file && node.children.length > 0;
  const isCollapsed = collapsedDirs.has(node.path);

  if (isDir) {
    return (
      <>
        <div
          onClick={() => onToggleDir(node.path)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            paddingLeft: 8 + depth * 16,
            cursor: "pointer",
            fontSize: 11,
            color: "var(--text-secondary)",
            userSelect: "none",
          }}
          className="file-item-row"
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <IconFolder size={13} />
          <span style={{ fontWeight: 500 }}>{node.name}</span>
        </div>
        {!isCollapsed &&
          node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              selectedPaths={selectedPaths}
              onSelectFile={onSelectFile}
              onToggleSelect={onToggleSelect}
              collapsedDirs={collapsedDirs}
              onToggleDir={onToggleDir}
              showDiscard={showDiscard}
              onDiscard={onDiscard}
              onStageFile={onStageFile}
              onUnstageFile={onUnstageFile}
              onAddToGitignore={onAddToGitignore}
              onFileHistory={onFileHistory}
              onFileBlame={onFileBlame}
            />
          ))}
      </>
    );
  }

  // It's a file
  if (!node.file) return null;

  const file = node.file;
  const isSelected = file.path === selectedFile;
  const isChecked = selectedPaths.has(file.path);

  return (
    <FileRow
      file={file}
      name={node.name}
      depth={depth}
      selected={isSelected}
      checked={isChecked}
      onSelect={() => onSelectFile(file.path)}
      onToggleCheck={() => onToggleSelect(file.path)}
      showDiscard={showDiscard}
      onDiscard={() => onDiscard([file.path])}
      onStage={onStageFile ? () => onStageFile(file.path) : undefined}
      onUnstage={onUnstageFile ? () => onUnstageFile(file.path) : undefined}
      onAddToGitignore={onAddToGitignore}
      onFileHistory={onFileHistory}
      onFileBlame={onFileBlame}
    />
  );
};

/* ─── Flat File Row ─── */

const FlatFileRow: React.FC<{
  file: ChangedFile;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  showDiscard: boolean;
  onDiscard: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onAddToGitignore: (pattern: string) => void;
  onFileHistory?: (path: string) => void;
  onFileBlame?: (path: string) => void;
  dragPaths?: string[];
}> = ({
  file,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  showDiscard,
  onDiscard,
  onStage,
  onUnstage,
  onAddToGitignore,
  onFileHistory,
  onFileBlame,
  dragPaths,
}) => {
  const fileName = file.path.split("/").pop() || file.path;
  const dirPath = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";

  return (
    <FileRow
      file={file}
      name={fileName}
      dirPath={dirPath}
      depth={0}
      selected={selected}
      checked={checked}
      onSelect={onSelect}
      onToggleCheck={onToggleCheck}
      showDiscard={showDiscard}
      onDiscard={onDiscard}
      onStage={onStage}
      onUnstage={onUnstage}
      onAddToGitignore={onAddToGitignore}
      onFileHistory={onFileHistory}
      onFileBlame={onFileBlame}
      dragPaths={dragPaths}
    />
  );
};

/* ─── Shared File Row ─── */

const FileRow: React.FC<{
  file: ChangedFile;
  name: string;
  dirPath?: string;
  depth: number;
  selected: boolean;
  checked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  showDiscard: boolean;
  onDiscard: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onAddToGitignore: (pattern: string) => void;
  onFileHistory?: (path: string) => void;
  onFileBlame?: (path: string) => void;
  dragPaths?: string[];
}> = ({
  file,
  name,
  dirPath,
  depth,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  showDiscard,
  onDiscard,
  onStage,
  onUnstage,
  onAddToGitignore,
  onFileHistory,
  onFileBlame,
  dragPaths,
}) => {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const statusColors: Record<string, string> = {
    added: "var(--green)",
    modified: "var(--peach)",
    deleted: "var(--red)",
    renamed: "var(--mauve)",
    untracked: "var(--yellow)",
    copied: "var(--accent)",
    conflicted: "var(--red)",
  };
  const statusLetters: Record<string, string> = {
    added: "A",
    modified: "M",
    deleted: "D",
    renamed: "R",
    untracked: "?",
    copied: "C",
    conflicted: "!",
  };

  const color = statusColors[file.status] || "var(--text-muted)";
  const letter = statusLetters[file.status] || "?";

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const copyPath = () => {
    navigator.clipboard.writeText(file.path);
    closeContextMenu();
  };

  const copyFileName = () => {
    const fname = file.path.split("/").pop() || file.path;
    navigator.clipboard.writeText(fname);
    closeContextMenu();
  };

  const openFile = async () => {
    closeContextMenu();
    try {
      await window.electronAPI.shell.openFile(file.path);
    } catch {}
  };

  const showInFolder = async () => {
    closeContextMenu();
    try {
      await window.electronAPI.shell.showInFolder(file.path);
    } catch {}
  };

  return (
    <>
      <div
        onClick={onSelect}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={(e) => {
          const paths = dragPaths && dragPaths.length > 0 ? dragPaths : [file.path];
          e.dataTransfer.setData("application/git-expansion-files", JSON.stringify(paths));
          e.dataTransfer.effectAllowed = "move";
        }}
        className="file-item-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          paddingLeft: 8 + depth * 16,
          cursor: "pointer",
          background: selected ? "var(--accent-dim)" : "transparent",
          borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
          transition: "background 0.1s",
          fontSize: 11,
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.background = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.background = "transparent";
          setConfirmDiscard(false);
        }}
      >
        {/* Selection checkbox */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleCheck();
          }}
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: checked ? "none" : "1.5px solid var(--border)",
            background: checked ? "var(--accent)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.12s",
          }}
        >
          {checked && (
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--surface-0)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Status badge */}
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            background: `${color}20`,
            color,
            flexShrink: 0,
          }}
        >
          {letter}
        </span>

        {/* File name */}
        <span
          className="truncate"
          style={{ color: "var(--text-primary)", flexShrink: 1, minWidth: 0 }}
          title={file.path}
        >
          {name}
        </span>
        {dirPath && (
          <span
            className="truncate"
            style={{
              color: "var(--text-muted)",
              fontSize: 9,
              flexShrink: 2,
              minWidth: 0,
            }}
          >
            {dirPath}
          </span>
        )}

        {/* Discard button */}
        {showDiscard && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              marginLeft: "auto",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {confirmDiscard ? (
              <>
                <button
                  onClick={() => {
                    onDiscard();
                    setConfirmDiscard(false);
                  }}
                  style={{
                    fontSize: 8,
                    fontWeight: 600,
                    color: "var(--red)",
                    background: "var(--red-dim)",
                    border: "none",
                    cursor: "pointer",
                    padding: "1px 4px",
                    borderRadius: 3,
                  }}
                >
                  Discard
                </button>
                <button
                  onClick={() => setConfirmDiscard(false)}
                  style={{
                    fontSize: 8,
                    color: "var(--text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "1px 3px",
                  }}
                >
                  No
                </button>
              </>
            ) : (
              <button
                className="file-discard-btn"
                onClick={() => setConfirmDiscard(true)}
                title="Discard changes"
                style={{
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 1,
                  borderRadius: 3,
                  display: "flex",
                  opacity: 0,
                  transition: "opacity 0.1s, color 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <IconDiscard size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={file}
          isStaged={file.staged}
          onClose={closeContextMenu}
          onStage={onStage}
          onUnstage={onUnstage}
          onDiscard={showDiscard ? onDiscard : undefined}
          onOpenFile={openFile}
          onShowInFolder={showInFolder}
          onCopyPath={copyPath}
          onCopyFileName={copyFileName}
          onAddToGitignore={onAddToGitignore}
          onFileHistory={onFileHistory}
          onFileBlame={onFileBlame}
        />
      )}
    </>
  );
};

/* ─── Dropdown menu item ─── */

const DropdownItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}> = ({ icon, label, onClick, disabled, danger, active }) => (
  <button
    onClick={disabled ? undefined : onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      padding: "7px 12px",
      border: "none",
      background: active ? "var(--accent-dim)" : "transparent",
      color: disabled ? "var(--text-muted)" : danger ? "var(--red)" : "var(--text-primary)",
      fontSize: 11,
      cursor: disabled ? "not-allowed" : "pointer",
      textAlign: "left",
      transition: "background 0.1s",
    }}
    onMouseEnter={(e) => {
      if (!disabled)
        e.currentTarget.style.background = danger ? "var(--red-dim)" : "var(--surface-hover)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = active ? "var(--accent-dim)" : "transparent";
    }}
  >
    {icon}
    {label}
  </button>
);

/* ─── Small reusable components ─── */

const StageIconButton: React.FC<{
  title: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, disabled, onClick, children }) => (
  <button
    title={title}
    disabled={disabled}
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 26,
      height: 26,
      borderRadius: 4,
      border: "1px solid var(--border)",
      background: disabled ? "transparent" : "var(--surface-1)",
      color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.12s",
      opacity: disabled ? 0.4 : 1,
      padding: 0,
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = "var(--surface-2)";
        e.currentTarget.style.color = "var(--accent)";
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = disabled ? "transparent" : "var(--surface-1)";
      e.currentTarget.style.color = disabled ? "var(--text-muted)" : "var(--text-secondary)";
    }}
  >
    {children}
  </button>
);

const IconButton: React.FC<{
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, active, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 22,
      height: 22,
      borderRadius: 4,
      border: "none",
      background: active ? "var(--accent-dim)" : "transparent",
      color: active ? "var(--accent)" : "var(--text-muted)",
      cursor: "pointer",
      transition: "all 0.12s",
    }}
  >
    {children}
  </button>
);

/* ─── File Context Menu ─── */

const FileContextMenu: React.FC<{
  x: number;
  y: number;
  file: ChangedFile;
  isStaged: boolean;
  onClose: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onOpenFile: () => void;
  onShowInFolder: () => void;
  onCopyPath: () => void;
  onCopyFileName: () => void;
  onAddToGitignore: (pattern: string) => void;
  onFileHistory?: (path: string) => void;
  onFileBlame?: (path: string) => void;
}> = ({
  x,
  y,
  file,
  isStaged,
  onClose,
  onStage,
  onUnstage,
  onDiscard,
  onOpenFile,
  onShowInFolder,
  onCopyPath,
  onCopyFileName,
  onAddToGitignore,
  onFileHistory,
  onFileBlame,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Adjust position to stay within viewport
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;
      if (rect.right > window.innerWidth) newX = window.innerWidth - rect.width - 8;
      if (rect.bottom > window.innerHeight) newY = window.innerHeight - rect.height - 8;
      if (newX < 0) newX = 8;
      if (newY < 0) newY = 8;
      if (newX !== x || newY !== y) setPos({ x: newX, y: newY });
    }
  }, [x, y]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: "6px 14px",
    border: "none",
    background: "transparent",
    color: "var(--text-primary)",
    fontSize: 11,
    cursor: "pointer",
    textAlign: "left",
    whiteSpace: "nowrap",
    transition: "background 0.08s",
  };

  const separator = (
    <div style={{ height: 1, background: "var(--border-subtle)", margin: "3px 0" }} />
  );

  const handleItemHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "var(--surface-hover)";
  };
  const handleItemLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "transparent";
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 200,
        minWidth: 200,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        padding: "4px 0",
        overflow: "hidden",
      }}
    >
      {/* Stage / Unstage */}
      {isStaged && onUnstage && (
        <button
          style={menuItemStyle}
          onClick={() => {
            onUnstage();
            onClose();
          }}
          onMouseEnter={handleItemHover}
          onMouseLeave={handleItemLeave}
        >
          <IconArrowUp size={13} /> Unstage
        </button>
      )}
      {!isStaged && onStage && (
        <button
          style={menuItemStyle}
          onClick={() => {
            onStage();
            onClose();
          }}
          onMouseEnter={handleItemHover}
          onMouseLeave={handleItemLeave}
        >
          <IconArrowDown size={13} /> Stage
        </button>
      )}

      {/* Discard */}
      {onDiscard && !confirmDiscard && (
        <button
          style={{ ...menuItemStyle, color: "var(--red)" }}
          onClick={() => setConfirmDiscard(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--red-dim)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <IconDiscard size={13} /> Reset file changes
        </button>
      )}
      {onDiscard && confirmDiscard && (
        <button
          style={{ ...menuItemStyle, color: "var(--red)", fontWeight: 600 }}
          onClick={() => {
            onDiscard();
            onClose();
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--red-dim)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <IconDiscard size={13} /> Confirm reset?
        </button>
      )}

      {separator}

      {/* File history & blame */}
      {onFileHistory && (
        <button
          style={menuItemStyle}
          onClick={() => {
            onFileHistory(file.path);
            onClose();
          }}
          onMouseEnter={handleItemHover}
          onMouseLeave={handleItemLeave}
        >
          <IconHistory size={13} /> File history
        </button>
      )}
      {onFileBlame && (
        <button
          style={menuItemStyle}
          onClick={() => {
            onFileBlame(file.path);
            onClose();
          }}
          onMouseEnter={handleItemHover}
          onMouseLeave={handleItemLeave}
        >
          <IconBlame size={13} /> Blame
        </button>
      )}

      {separator}

      {/* Open file */}
      <button
        style={menuItemStyle}
        onClick={onOpenFile}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconOpenFile size={13} /> Open file
      </button>
      <button
        style={menuItemStyle}
        onClick={onShowInFolder}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconFolder size={13} /> Show in folder
      </button>

      {separator}

      {/* Gitignore actions */}
      <button
        style={menuItemStyle}
        onClick={() => {
          onAddToGitignore(file.path);
          onClose();
        }}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconGitignore size={13} /> Add file to .gitignore
      </button>
      {file.path.includes("/") && (
        <button
          style={menuItemStyle}
          onClick={() => {
            onAddToGitignore(file.path.slice(0, file.path.lastIndexOf("/")) + "/");
            onClose();
          }}
          onMouseEnter={handleItemHover}
          onMouseLeave={handleItemLeave}
        >
          <IconGitignore size={13} /> Add folder to .gitignore
        </button>
      )}
      {(() => {
        const ext = file.path.includes(".") ? file.path.slice(file.path.lastIndexOf(".")) : "";
        if (!ext) return null;
        return (
          <button
            style={menuItemStyle}
            onClick={() => {
              onAddToGitignore("*" + ext);
              onClose();
            }}
            onMouseEnter={handleItemHover}
            onMouseLeave={handleItemLeave}
          >
            <IconGitignore size={13} /> Add *{ext} to .gitignore
          </button>
        );
      })()}

      {separator}

      {/* Copy actions */}
      <button
        style={menuItemStyle}
        onClick={onCopyPath}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconCopy size={13} /> Copy path
      </button>
      <button
        style={menuItemStyle}
        onClick={onCopyFileName}
        onMouseEnter={handleItemHover}
        onMouseLeave={handleItemLeave}
      >
        <IconCopy size={13} /> Copy file name
      </button>
    </div>
  );
};

/* ─── Toolbar Button ─── */

const ToolbarButton: React.FC<{
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  hasDropdown?: boolean;
  active?: boolean;
}> = ({ label, onClick, icon, hasDropdown, active }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 8px",
      borderRadius: 5,
      border: "1px solid var(--border)",
      background: active ? "var(--accent-dim)" : "var(--surface-0)",
      color: active ? "var(--accent)" : "var(--text-secondary)",
      fontSize: 11,
      cursor: "pointer",
      transition: "all 0.12s",
      whiteSpace: "nowrap",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = "var(--surface-2)";
      e.currentTarget.style.borderColor = "var(--accent)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = active ? "var(--accent-dim)" : "var(--surface-0)";
      e.currentTarget.style.borderColor = "var(--border)";
    }}
  >
    {icon}
    {label}
    {hasDropdown && (
      <svg
        width="8"
        height="8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    )}
  </button>
);

/* ─── Icons ─── */

const IconGitCommit = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--accent)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="4" />
    <line x1="1.05" y1="12" x2="7" y2="12" />
    <line x1="17.01" y1="12" x2="22.96" y2="12" />
  </svg>
);

const IconDiscard: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

const IconArrowDown: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
);

const IconDoubleArrowDown: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="7 7 12 12 17 7" />
    <polyline points="7 13 12 18 17 13" />
  </svg>
);

const IconArrowUp: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconDoubleArrowUp: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="17 18 12 13 7 18" />
    <polyline points="17 12 12 7 7 12" />
  </svg>
);

const IconCheck: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconAmend: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconStash: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
);

const IconFolder: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="var(--yellow)"
    stroke="var(--yellow)"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    opacity={0.7}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const IconTree: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="12" y1="12" x2="21" y2="12" />
    <line x1="12" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="7" y1="12" x2="7.01" y2="12" />
    <line x1="7" y1="18" x2="7.01" y2="18" />
  </svg>
);

const IconList: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconCopy: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconOpenFile: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
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

const IconHistory: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconBlame: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconSnippet: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

const IconTemplate: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconBranch: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const IconGitignore: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const IconRefresh: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const AuthorInfo: React.FC = () => {
  const { currentAccount } = useAccountStore();
  const [gitName, setGitName] = useState("");
  const [gitEmail, setGitEmail] = useState("");

  useEffect(() => {
    if (!currentAccount) {
      // Fallback: read from git config
      Promise.all([
        window.electronAPI.gitConfig.get("user.name"),
        window.electronAPI.gitConfig.get("user.email"),
      ]).then(([name, email]) => {
        setGitName(name);
        setGitEmail(email);
      });
    }
  }, [currentAccount]);

  const name = currentAccount?.name || gitName;
  const email = currentAccount?.email || gitEmail;

  if (!name && !email) return null;

  return (
    <div
      style={{
        fontSize: 11,
        color: "var(--text-muted)",
        padding: "2px 2px",
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
      <span>
        Author: {name}
        {email && ` <${email}>`}
        {currentAccount && (
          <span style={{ color: "var(--accent)", marginLeft: 6 }}>({currentAccount.label})</span>
        )}
      </span>
    </div>
  );
};
