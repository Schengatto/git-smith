import React, { useState, useEffect } from "react";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

type ResetMode = "soft" | "mixed" | "hard";

interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
  commitSubject: string;
}

const MODES: { value: ResetMode; label: string; description: string; color: string }[] = [
  {
    value: "soft",
    label: "Soft",
    description: "Move HEAD only. Staged and working directory unchanged.",
    color: "var(--green)",
  },
  {
    value: "mixed",
    label: "Mixed",
    description: "Move HEAD and reset staging area. Working directory unchanged.",
    color: "var(--yellow)",
  },
  {
    value: "hard",
    label: "Hard",
    description: "Move HEAD, reset staging area and working directory. All changes will be lost!",
    color: "var(--red)",
  },
];

export const ResetDialog: React.FC<Props> = ({ open, onClose, commitHash, commitSubject }) => {
  const [mode, setMode] = useState<ResetMode>("mixed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshInfo, refreshStatus, repo } = useRepoStore();
  const { loadGraph } = useGraphStore();
  const isDetached = repo?.currentBranch === "(detached)";

  useEffect(() => {
    if (open) {
      setMode("mixed");
      setError(null);
    }
  }, [open]);

  const handleReset = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.branch.reset(commitHash, mode);
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const selectedMode = MODES.find((m) => m.value === mode)!;

  return (
    <ModalDialog open={open} title="Reset Branch" onClose={onClose} width={460}>
      {/* Target commit */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          Reset to
        </div>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--surface-0)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>
            {commitHash.slice(0, 10)}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 2 }}>
            {commitSubject}
          </div>
        </div>
      </div>

      {/* Detached HEAD warning */}
      {isDetached && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--yellow-dim, rgba(249,226,175,0.15))",
            border: "1px solid var(--yellow)",
            fontSize: 11,
            color: "var(--yellow)",
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          HEAD is detached — no local branch is currently checked out. This reset will only move HEAD, not any branch. Checkout a branch first if you want to reset it.
        </div>
      )}

      {/* Mode selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          Reset mode
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MODES.map((m) => (
            <label
              key={m.value}
              onClick={() => setMode(m.value)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 6,
                cursor: "pointer",
                border: mode === m.value
                  ? `1.5px solid ${m.color}`
                  : "1.5px solid var(--border-subtle)",
                background: mode === m.value ? `${m.color}10` : "transparent",
                transition: "all 0.15s",
              }}
            >
              {/* Radio */}
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: mode === m.value ? `4px solid ${m.color}` : "2px solid var(--border)",
                  background: "transparent",
                  flexShrink: 0,
                  marginTop: 1,
                  transition: "all 0.15s",
                }}
              />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: m.color }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.4 }}>
                  {m.description}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Hard reset warning */}
      {mode === "hard" && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--red-dim)",
            border: "1px solid var(--red)",
            fontSize: 11,
            color: "var(--red)",
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        >
          This will permanently discard all uncommitted changes in your working directory and staging area. This action cannot be undone.
        </div>
      )}

      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleReset}
        confirmLabel={`Reset ${selectedMode.label}`}
        confirmColor={selectedMode.color}
        loading={loading}
      />
    </ModalDialog>
  );
};
