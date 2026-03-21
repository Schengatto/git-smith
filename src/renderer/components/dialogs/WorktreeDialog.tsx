import React, { useState, useEffect, useCallback } from "react";
import { ModalDialog, DialogInput } from "./ModalDialog";
import type { WorktreeInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const WorktreeDialog: React.FC<Props> = ({ open, onClose }) => {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [createBranch, setCreateBranch] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.worktree.list();
      setWorktrees(list);
    } catch {
      setWorktrees([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      setShowAdd(false);
      setError("");
    }
  }, [open, refresh]);

  const handleAdd = async () => {
    if (!newPath.trim()) { setError("Path is required"); return; }
    setError("");
    try {
      await window.electronAPI.worktree.add(
        newPath.trim(),
        newBranch.trim() || undefined,
        createBranch
      );
      setNewPath("");
      setNewBranch("");
      setCreateBranch(false);
      setShowAdd(false);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRemove = async (path: string) => {
    setError("");
    try {
      await window.electronAPI.worktree.remove(path);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleBrowse = async () => {
    const dir = await window.electronAPI.repo.browseDirectory("Select worktree path");
    if (dir) setNewPath(dir);
  };

  const handleOpen = (path: string) => {
    window.electronAPI.shell.showInFolder(path);
  };

  return (
    <ModalDialog open={open} title="Worktrees" onClose={onClose} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {loading && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>
            Loading...
          </div>
        )}

        {!loading && worktrees.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>
            No worktrees found
          </div>
        )}

        {worktrees.map((wt) => (
          <div
            key={wt.path}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 6,
              background: wt.isMain ? "var(--accent-dim)" : "var(--surface-0)",
              border: `1px solid ${wt.isMain ? "var(--accent)" : "var(--border-subtle)"}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                {wt.branch || "(detached)"}
                {wt.isMain && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 6 }}>main</span>}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {wt.path}
              </div>
              {wt.head && (
                <div className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>
                  {wt.head.slice(0, 7)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="toolbar-btn"
                onClick={() => handleOpen(wt.path)}
                title="Open in file manager"
                style={{ fontSize: 10, padding: "3px 8px" }}
              >
                Open
              </button>
              {!wt.isMain && (
                <button
                  className="toolbar-btn"
                  onClick={() => handleRemove(wt.path)}
                  title="Remove worktree"
                  style={{ fontSize: 10, padding: "3px 8px", color: "var(--red)" }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add worktree form */}
        {showAdd ? (
          <div style={{
            padding: "10px 12px",
            borderRadius: 6,
            background: "var(--surface-0)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <DialogInput
                  label="Path"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="/path/to/worktree"
                />
              </div>
              <button className="toolbar-btn" onClick={handleBrowse} style={{ fontSize: 11, padding: "5px 10px", marginBottom: 2 }}>
                Browse
              </button>
            </div>
            <DialogInput
              label="Branch"
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="branch-name (optional)"
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={createBranch}
                onChange={(e) => setCreateBranch(e.target.checked)}
              />
              Create new branch
            </label>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button className="toolbar-btn" onClick={() => setShowAdd(false)} style={{ fontSize: 11, padding: "4px 12px" }}>
                Cancel
              </button>
              <button className="toolbar-btn" onClick={handleAdd} style={{ fontSize: 11, padding: "4px 12px", background: "var(--accent)", color: "var(--base)" }}>
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            className="toolbar-btn"
            onClick={() => setShowAdd(true)}
            style={{ fontSize: 12, padding: "6px 14px", alignSelf: "flex-start" }}
          >
            + Add Worktree
          </button>
        )}

        {error && (
          <div style={{ fontSize: 11, color: "var(--red)", padding: "4px 0" }}>{error}</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0" }}>
        <button className="toolbar-btn" onClick={onClose} style={{ fontSize: 12, padding: "6px 14px" }}>
          Close
        </button>
      </div>
    </ModalDialog>
  );
};
