import React, { useState, useEffect } from "react";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";
import type { BranchInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-selected branch/ref to merge (from context menu) */
  preselectedBranch?: string;
}

export const MergeDialog: React.FC<Props> = ({ open, onClose, preselectedBranch }) => {
  const { repo, refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const [allBranches, setAllBranches] = useState<BranchInfo[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [mergeStrategy, setMergeStrategy] = useState<"ff" | "no-ff">("ff");
  const [noCommit, setNoCommit] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [squash, setSquash] = useState(false);
  const [allowUnrelatedHistories, setAllowUnrelatedHistories] = useState(false);
  const [addLogMessages, setAddLogMessages] = useState(false);
  const [logCount, setLogCount] = useState(20);
  const [specifyMessage, setSpecifyMessage] = useState(false);
  const [mergeMessage, setMergeMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
      setMergeStrategy("ff");
      setNoCommit(false);
      setShowAdvanced(false);
      setSquash(false);
      setAllowUnrelatedHistories(false);
      setAddLogMessages(false);
      setLogCount(20);
      setSpecifyMessage(false);
      setMergeMessage("");

      if (preselectedBranch) {
        setSelectedBranch(preselectedBranch);
      }

      // Load branches for the dropdown
      window.electronAPI.branch.list().then((branches) => {
        setAllBranches(branches);
        if (!preselectedBranch && branches.length > 0) {
          const nonCurrent = branches.find((b) => !b.current);
          setSelectedBranch(nonCurrent?.name || branches[0]!.name);
        }
      });
    }
    // Only run when dialog opens/closes; loads branch list on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Squash disables "squash commits" when "always create merge commit" is not selected
  // In Git Extensions, squash is disabled when "no-ff" is not selected
  const squashDisabled = mergeStrategy !== "no-ff";

  const handleMerge = async () => {
    setLoading(true);
    setError(null);
    try {
      await runGitOperation("Merge", () =>
        window.electronAPI.branch.mergeWithOptions({
          branch: selectedBranch,
          mergeStrategy,
          noCommit: noCommit || undefined,
          squash: (!squashDisabled && squash) || undefined,
          allowUnrelatedHistories: allowUnrelatedHistories || undefined,
          log: addLogMessages ? logCount : undefined,
          message: specifyMessage && mergeMessage ? mergeMessage : undefined,
        })
      );
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const currentBranch = repo?.currentBranch || "HEAD";

  return (
    <ModalDialog open={open} title="Merge branches" onClose={onClose} width={480}>
      {/* Merge branch selector */}
      <div style={{ marginBottom: 10 }}>
        <label style={fieldLabelStyle}>Merge branch</label>
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          style={selectStyle}
        >
          {allBranches
            .filter((b) => !b.current)
            .map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
        </select>
      </div>

      {/* Into current branch */}
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Into current branch</span>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--text-primary)",
          padding: "2px 8px",
          borderRadius: 4,
          background: "var(--accent-dim)",
        }}>
          {currentBranch}
        </span>
      </div>

      {/* Merge strategy */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            checked={mergeStrategy === "ff"}
            onChange={() => setMergeStrategy("ff")}
            style={radioStyle}
          />
          Keep a single branch line if possible (fast forward)
        </label>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            checked={mergeStrategy === "no-ff"}
            onChange={() => setMergeStrategy("no-ff")}
            style={radioStyle}
          />
          Always create a new merge commit
        </label>
      </div>

      {/* Do not commit */}
      <label style={{ ...checkboxLabelStyle, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={noCommit}
          onChange={(e) => setNoCommit(e.target.checked)}
          style={checkboxStyle}
        />
        Do not commit
      </label>

      {/* Show advanced options */}
      <label style={{ ...checkboxLabelStyle, marginBottom: showAdvanced ? 10 : 0 }}>
        <input
          type="checkbox"
          checked={showAdvanced}
          onChange={(e) => setShowAdvanced(e.target.checked)}
          style={checkboxStyle}
        />
        Show advanced options
      </label>

      {/* Advanced options */}
      {showAdvanced && (
        <div style={{
          padding: "10px 12px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          marginBottom: 4,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}>
          <label style={{
            ...checkboxLabelStyle,
            opacity: squashDisabled ? 0.5 : 1,
            cursor: squashDisabled ? "not-allowed" : "pointer",
          }}>
            <input
              type="checkbox"
              checked={squash}
              onChange={(e) => setSquash(e.target.checked)}
              disabled={squashDisabled}
              style={checkboxStyle}
            />
            Squash commits
          </label>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={allowUnrelatedHistories}
              onChange={(e) => setAllowUnrelatedHistories(e.target.checked)}
              style={checkboxStyle}
            />
            Allow unrelated histories
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ ...checkboxLabelStyle, marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={addLogMessages}
                onChange={(e) => setAddLogMessages(e.target.checked)}
                style={checkboxStyle}
              />
              Add log messages
            </label>
            {addLogMessages && (
              <input
                type="number"
                min={1}
                max={999}
                value={logCount}
                onChange={(e) => setLogCount(Math.max(1, parseInt(e.target.value) || 20))}
                style={{
                  width: 56,
                  padding: "3px 6px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--surface-0)",
                  color: "var(--text-primary)",
                  fontSize: 12,
                  textAlign: "center",
                }}
              />
            )}
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={specifyMessage}
              onChange={(e) => setSpecifyMessage(e.target.checked)}
              style={checkboxStyle}
            />
            Specify merge message
          </label>
          {specifyMessage && (
            <textarea
              value={mergeMessage}
              onChange={(e) => setMergeMessage(e.target.value)}
              placeholder="Enter merge commit message..."
              rows={3}
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface-0)",
                color: "var(--text-primary)",
                fontSize: 12,
                resize: "vertical",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          )}
        </div>
      )}

      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleMerge}
        confirmLabel="Merge"
        loading={loading}
        disabled={!selectedBranch}
      />
    </ModalDialog>
  );
};

/* ---------- Styles ---------- */

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const radioLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
  userSelect: "none",
};

const radioStyle: React.CSSProperties = {
  margin: 0,
  accentColor: "var(--accent)",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "var(--text-secondary)",
  cursor: "pointer",
  userSelect: "none",
  marginBottom: 0,
};

const checkboxStyle: React.CSSProperties = {
  margin: 0,
  accentColor: "var(--accent)",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
};
