import React, { useState, useEffect, useCallback } from "react";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import type { StaleRemoteBranch, CommitInfo } from "../../../shared/git-types";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const StaleBranchesDialog: React.FC<Props> = ({ open, onClose }) => {
  const [days, setDays] = useState(30);
  const [branches, setBranches] = useState<StaleRemoteBranch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [commits, setCommits] = useState<Record<string, CommitInfo[]>>({});
  const [loadingCommits, setLoadingCommits] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBranches([]);
    setExpandedBranch(null);
    setCommits({});
    setDeleted(new Set());
    setConfirmDelete(null);
    try {
      const result = await window.electronAPI.branch.staleRemote(days);
      setBranches(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (open) loadBranches();
  }, [open, loadBranches]);

  const toggleExpand = async (branchName: string) => {
    if (expandedBranch === branchName) {
      setExpandedBranch(null);
      return;
    }
    setExpandedBranch(branchName);
    if (!commits[branchName]) {
      setLoadingCommits(branchName);
      try {
        const result = await window.electronAPI.branch.remoteCommits(branchName, 20);
        setCommits((prev) => ({ ...prev, [branchName]: result }));
      } catch {
        setCommits((prev) => ({ ...prev, [branchName]: [] }));
      } finally {
        setLoadingCommits(null);
      }
    }
  };

  const handleDelete = async (branch: StaleRemoteBranch) => {
    if (confirmDelete !== branch.name) {
      setConfirmDelete(branch.name);
      return;
    }
    setDeleting(branch.name);
    setError(null);
    try {
      await window.electronAPI.branch.deleteRemote(branch.remote, branch.branchName);
      setDeleted((prev) => new Set(prev).add(branch.name));
      setConfirmDelete(null);
      // Refresh repo state
      await Promise.all([
        useRepoStore.getState().refreshInfo(),
        useRepoStore.getState().refreshStatus(),
        useGraphStore.getState().loadGraph(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
    }
  };

  const handleClose = () => {
    setConfirmDelete(null);
    onClose();
  };

  const visibleBranches = branches.filter((b) => !deleted.has(b.name));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return "today";
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 30) return `${diffDays} days ago`;
    const months = Math.floor(diffDays / 30);
    if (months === 1) return "1 month ago";
    if (months < 12) return `${months} months ago`;
    const years = Math.floor(months / 12);
    return years === 1 ? "1 year ago" : `${years} years ago`;
  };

  return (
    <ModalDialog open={open} title="Stale Remote Branches" onClose={handleClose} width={680}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Show branches older than
          </label>
          <input
            type="number"
            min={1}
            max={3650}
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 30))}
            style={{
              width: 60,
              padding: "4px 8px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 12,
              textAlign: "center",
            }}
          />
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>days</label>
          <button
            onClick={loadBranches}
            disabled={loading}
            style={{
              padding: "4px 12px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: loading ? "not-allowed" : "pointer",
              marginLeft: 4,
            }}
          >
            {loading ? "Loading..." : "Search"}
          </button>
        </div>
      </div>

      <DialogError error={error} />

      <div
        style={{
          maxHeight: 400,
          overflowY: "auto",
          border: visibleBranches.length > 0 ? "1px solid var(--border-subtle)" : "none",
          borderRadius: 6,
        }}
      >
        {loading && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
            Scanning remote branches...
          </div>
        )}

        {!loading && visibleBranches.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
            {branches.length > 0 && deleted.size > 0
              ? "All stale branches have been deleted."
              : `No remote branches older than ${days} days found.`}
          </div>
        )}

        {visibleBranches.map((branch) => (
          <div key={branch.name}>
            {/* Branch row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                borderBottom: "1px solid var(--border-subtle)",
                background: expandedBranch === branch.name ? "var(--surface-2)" : "transparent",
                gap: 8,
              }}
            >
              {/* Expand toggle */}
              <button
                onClick={() => toggleExpand(branch.name)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: expandedBranch === branch.name ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Branch info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {branch.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {branch.lastCommitSubject} — <span style={{ color: "var(--yellow)" }}>{formatDate(branch.lastCommitDate)}</span> by {branch.lastCommitAuthor}
                </div>
              </div>

              {/* Delete button */}
              {confirmDelete === branch.name ? (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => handleDelete(branch)}
                    disabled={deleting === branch.name}
                    style={{
                      padding: "3px 10px",
                      borderRadius: 4,
                      border: "none",
                      background: "var(--red)",
                      color: "var(--surface-0)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: deleting === branch.name ? "not-allowed" : "pointer",
                    }}
                  >
                    {deleting === branch.name ? "..." : "Confirm"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDelete(branch)}
                  title={`Delete ${branch.name}`}
                  style={{
                    padding: "3px 10px",
                    borderRadius: 4,
                    border: "1px solid var(--red)",
                    background: "transparent",
                    color: "var(--red)",
                    fontSize: 11,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {/* Expanded commit list */}
            {expandedBranch === branch.name && (
              <div style={{ background: "var(--surface-0)", borderBottom: "1px solid var(--border-subtle)" }}>
                {loadingCommits === branch.name ? (
                  <div style={{ padding: 12, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                    Loading commits...
                  </div>
                ) : (commits[branch.name] || []).length === 0 ? (
                  <div style={{ padding: 12, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                    No commits found.
                  </div>
                ) : (
                  (commits[branch.name] || []).map((commit) => (
                    <div
                      key={commit.hash}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        padding: "6px 12px 6px 36px",
                        borderBottom: "1px solid var(--border-subtle)",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: "var(--accent)",
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {commit.abbreviatedHash}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {commit.subject}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                          {commit.authorName} — {formatDate(commit.authorDate)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {visibleBranches.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          {visibleBranches.length} stale branch{visibleBranches.length !== 1 ? "es" : ""} found
          {deleted.size > 0 && ` (${deleted.size} deleted)`}
        </div>
      )}

      <DialogActions
        onCancel={handleClose}
        onConfirm={handleClose}
        confirmLabel="Close"
      />
    </ModalDialog>
  );
};
