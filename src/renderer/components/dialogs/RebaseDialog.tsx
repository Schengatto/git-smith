import React, { useState, useEffect, useCallback } from "react";
import { ModalDialog, DialogError } from "./ModalDialog";
import { openDialogWindow } from "../../utils/open-dialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";
import type { CommitInfo } from "../../../shared/git-types";

type RebaseAction = "pick" | "reword" | "squash" | "fixup" | "edit" | "drop";

interface TodoEntry {
  action: RebaseAction;
  commit: CommitInfo;
  status?: "pending" | "applied" | "applying" | "conflict";
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-selected commit hash or branch name to rebase onto */
  preselectedOnto?: string;
  /** Open directly in interactive mode */
  startInteractive?: boolean;
}

const ACTIONS: { value: RebaseAction; label: string; color: string }[] = [
  { value: "pick", label: "pick", color: "var(--green)" },
  { value: "reword", label: "reword", color: "var(--accent)" },
  { value: "squash", label: "squash", color: "var(--yellow)" },
  { value: "fixup", label: "fixup", color: "var(--peach)" },
  { value: "edit", label: "edit", color: "var(--mauve)" },
  { value: "drop", label: "drop", color: "var(--red)" },
];

export const RebaseDialog: React.FC<Props> = ({
  open,
  onClose,
  preselectedOnto,
  startInteractive,
}) => {
  const { repo, refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const [rebaseOn, setRebaseOn] = useState("");
  const [interactive, setInteractive] = useState(false);
  const [preserveMerges, setPreserveMerges] = useState(false);
  const [autosquash, setAutosquash] = useState(false);
  const [autoStash, setAutoStash] = useState(false);
  const [ignoreDate, setIgnoreDate] = useState(false);
  const [committerDateIsAuthorDate, setCommitterDateIsAuthorDate] = useState(false);
  const [updateRefs, setUpdateRefs] = useState(false);
  const [specificRange, setSpecificRange] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [showOptions, setShowOptions] = useState(true);

  const [entries, setEntries] = useState<TodoEntry[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Rebase-in-progress state
  const [rebaseInProgress, setRebaseInProgress] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
      setInteractive(startInteractive || false);
      setPreserveMerges(false);
      setAutosquash(false);
      setAutoStash(false);
      setIgnoreDate(false);
      setCommitterDateIsAuthorDate(false);
      setUpdateRefs(false);
      setSpecificRange(false);
      setRangeFrom("");
      setRangeTo("");
      setEntries([]);
      setShowOptions(true);

      if (preselectedOnto) {
        setRebaseOn(preselectedOnto);
      } else {
        setRebaseOn("");
      }

      // Check if a rebase is already in progress
      window.electronAPI.branch.isRebaseInProgress().then((inProgress) => {
        setRebaseInProgress(inProgress);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load commits when rebaseOn changes
  useEffect(() => {
    if (!open || !rebaseOn) {
      setEntries([]);
      return;
    }
    setLoadingCommits(true);
    window.electronAPI.branch
      .rebaseCommits(rebaseOn)
      .then((commits) => {
        setEntries(commits.map((c) => ({ action: "pick" as RebaseAction, commit: c })));
      })
      .catch(() => {
        setEntries([]);
      })
      .finally(() => setLoadingCommits(false));
  }, [open, rebaseOn]);

  const setAction = useCallback((index: number, action: RebaseAction) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], action };
      return next;
    });
  }, []);

  const handleRebase = async () => {
    if (!rebaseOn) return;
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Rebase", () =>
        window.electronAPI.branch.rebaseWithOptions({
          onto: rebaseOn,
          interactive: interactive || undefined,
          preserveMerges: preserveMerges || undefined,
          autosquash: autosquash || undefined,
          autoStash: autoStash || undefined,
          ignoreDate: ignoreDate || undefined,
          committerDateIsAuthorDate: committerDateIsAuthorDate || undefined,
          updateRefs: updateRefs || undefined,
          rangeFrom: specificRange && rangeFrom ? rangeFrom : undefined,
          rangeTo: specificRange && rangeTo ? rangeTo : undefined,
          todoEntries:
            interactive && entries.length > 0
              ? entries.map((e) => ({ action: e.action, hash: e.commit.hash }))
              : undefined,
        })
      );
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      // Check if this triggered a conflict / rebase-in-progress
      window.electronAPI.branch.isRebaseInProgress().then((inProgress) => {
        setRebaseInProgress(inProgress);
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Rebase --continue", () =>
        window.electronAPI.branch.rebaseContinue()
      );
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      // Check if rebase finished
      const stillInProgress = await window.electronAPI.branch.isRebaseInProgress();
      if (!stillInProgress) {
        setRebaseInProgress(false);
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Rebase --abort", () =>
        window.electronAPI.branch.rebaseAbort()
      );
      setRebaseInProgress(false);
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Rebase --skip", () =>
        window.electronAPI.branch.rebaseSkip()
      );
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      const stillInProgress = await window.electronAPI.branch.isRebaseInProgress();
      if (!stillInProgress) {
        setRebaseInProgress(false);
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const currentBranch = repo?.currentBranch || "HEAD";

  return (
    <ModalDialog open={open} title="Rebase" onClose={onClose} width={720}>
      {/* Header info */}
      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Rebase current branch on top of another branch
        </span>
      </div>

      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Current branch:</span>
        <span style={branchBadgeStyle}>{currentBranch}</span>
      </div>

      {/* Rebase on selector */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>Rebase on</span>
        <input
          type="text"
          value={rebaseOn}
          onChange={(e) => setRebaseOn(e.target.value)}
          placeholder="commit hash or branch name..."
          style={inputStyle}
          disabled={rebaseInProgress}
        />
      </div>

      {/* Options section */}
      {!rebaseInProgress && (
        <>
          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setShowOptions(!showOptions)}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              {showOptions ? "Hide options" : "Show options"}
            </button>
          </div>

          {showOptions && (
            <div style={{
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: 6,
              marginBottom: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              {/* Row 1: Interactive, Preserve Merges, Autosquash, Auto stash, Ignore date */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} style={checkboxStyle} />
                  Interactive Rebase
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={preserveMerges} onChange={(e) => setPreserveMerges(e.target.checked)} style={checkboxStyle} />
                  Preserve Merges
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={autosquash} onChange={(e) => setAutosquash(e.target.checked)} style={checkboxStyle} />
                  Autosquash
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={autoStash} onChange={(e) => setAutoStash(e.target.checked)} style={checkboxStyle} />
                  Auto stash
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={ignoreDate} onChange={(e) => setIgnoreDate(e.target.checked)} style={checkboxStyle} />
                  Ignore date
                </label>
              </div>

              {/* Row 2: Committer date, Update dependent refs */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={committerDateIsAuthorDate} onChange={(e) => setCommitterDateIsAuthorDate(e.target.checked)} style={checkboxStyle} />
                  Committer date is author date
                </label>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={updateRefs} onChange={(e) => setUpdateRefs(e.target.checked)} style={checkboxStyle} />
                  Update dependent refs
                </label>
              </div>

              {/* Specific range */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={specificRange} onChange={(e) => setSpecificRange(e.target.checked)} style={checkboxStyle} />
                  Specific range
                </label>
                {specificRange && (
                  <>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>From (exc.)</span>
                    <input
                      type="text"
                      value={rangeFrom}
                      onChange={(e) => setRangeFrom(e.target.value)}
                      style={{ ...inputStyle, width: 120, padding: "4px 6px", fontSize: 11 }}
                      placeholder="commit..."
                    />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>To</span>
                    <input
                      type="text"
                      value={rangeTo}
                      onChange={(e) => setRangeTo(e.target.value)}
                      style={{ ...inputStyle, width: 120, padding: "4px 6px", fontSize: 11 }}
                      placeholder="branch..."
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Rebase in progress banner */}
      {rebaseInProgress && (
        <div style={{
          padding: "8px 12px",
          marginBottom: 10,
          borderRadius: 6,
          background: "var(--red)20",
          border: "1px solid var(--red)40",
          color: "var(--red)",
          fontSize: 12,
          fontWeight: 500,
        }}>
          There are unresolved merge conflicts
        </div>
      )}

      {/* Commits to re-apply */}
      <div style={{ marginBottom: 8 }}>
        <span style={fieldLabelStyle}>Commits to re-apply</span>
      </div>

      <div style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 10,
      }}>
        {/* Table header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-0)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-muted)",
          gap: 8,
        }}>
          {interactive && <span style={{ width: 60 }}>Action</span>}
          <span style={{ flex: 3, minWidth: 0 }}>Subject</span>
          <span style={{ width: 120 }}>Author</span>
          <span style={{ width: 120, textAlign: "right" }}>Date</span>
          <span style={{ width: 90, textAlign: "right" }}>Commit hash</span>
        </div>

        {/* Table body */}
        <div style={{ maxHeight: 220, overflowY: "auto" }}>
          {loadingCommits ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              Loading commits...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
              {rebaseOn ? "No commits to rebase" : "Select a branch or commit to rebase onto"}
            </div>
          ) : (
            entries.map((entry, i) => (
              <div
                key={entry.commit.hash}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "5px 10px",
                  borderBottom: i < entries.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  fontSize: 11,
                  gap: 8,
                  opacity: entry.action === "drop" ? 0.4 : 1,
                }}
              >
                {interactive && (
                  <select
                    value={entry.action}
                    onChange={(e) => setAction(i, e.target.value as RebaseAction)}
                    style={{
                      width: 60,
                      padding: "1px 2px",
                      borderRadius: 3,
                      border: `1px solid ${ACTIONS.find((a) => a.value === entry.action)?.color || "var(--border)"}40`,
                      background: `${ACTIONS.find((a) => a.value === entry.action)?.color || "var(--border)"}15`,
                      color: ACTIONS.find((a) => a.value === entry.action)?.color || "var(--text-primary)",
                      fontSize: 10,
                      fontWeight: 600,
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                )}
                <span
                  className="truncate"
                  style={{
                    flex: 3,
                    minWidth: 0,
                    color: entry.action === "drop" ? "var(--text-muted)" : "var(--text-primary)",
                    textDecoration: entry.action === "drop" ? "line-through" : "none",
                  }}
                >
                  {entry.commit.subject}
                </span>
                <span className="truncate" style={{ width: 120, color: "var(--text-muted)" }}>
                  {entry.commit.authorName}
                </span>
                <span style={{ width: 120, textAlign: "right", color: "var(--text-muted)" }}>
                  {formatDate(entry.commit.authorDate)}
                </span>
                <span className="mono" style={{ width: 90, textAlign: "right", color: "var(--text-muted)" }}>
                  {entry.commit.abbreviatedHash}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <DialogError error={error} />

      {/* Action buttons */}
      {rebaseInProgress ? (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 8,
        }}>
          <button onClick={handleSkip} disabled={loading} style={secondaryBtnStyle}>
            Skip currently applying commit
          </button>
          <button onClick={() => openDialogWindow({ dialog: "MergeConflictDialog" })} disabled={loading} style={primaryBtnStyle}>
            Solve conflicts
          </button>
          <button onClick={handleAbort} disabled={loading} style={dangerBtnStyle}>
            Abort
          </button>
        </div>
      ) : (
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 8,
        }}>
          <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
          <button
            onClick={handleRebase}
            disabled={loading || !rebaseOn}
            style={{
              ...primaryBtnStyle,
              opacity: loading || !rebaseOn ? 0.5 : 1,
              cursor: loading || !rebaseOn ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Rebasing..." : "Rebase"}
          </button>
        </div>
      )}

    </ModalDialog>
  );
};

/* ---------- Helpers ---------- */

function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }) + " " + d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

/* ---------- Styles ---------- */

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const branchBadgeStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-primary)",
  padding: "2px 8px",
  borderRadius: 4,
  background: "var(--accent-dim)",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  fontFamily: "monospace",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
  userSelect: "none",
};

const checkboxStyle: React.CSSProperties = {
  margin: 0,
  accentColor: "var(--accent)",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: "none",
  background: "var(--accent)",
  color: "var(--surface-0)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "7px 16px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
};

const dangerBtnStyle: React.CSSProperties = {
  padding: "7px 18px",
  borderRadius: 6,
  border: "none",
  background: "var(--red)",
  color: "var(--surface-0)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
