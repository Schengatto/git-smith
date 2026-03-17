import React, { useState, useEffect } from "react";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";

interface Props {
  open: boolean;
  onClose: () => void;
  suggestedRemote: string;
  suggestedBranch: string;
  force?: boolean;
}

export const SetUpstreamDialog: React.FC<Props> = ({
  open,
  onClose,
  suggestedRemote,
  suggestedBranch,
  force = false,
}) => {
  const { refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const [remotes, setRemotes] = useState<string[]>([]);
  const [selectedRemote, setSelectedRemote] = useState(suggestedRemote);
  const [remotesError, setRemotesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRemotesError(null);
    setPushError(null);
    setLoading(false);

    window.electronAPI.remote.list().then((list) => {
      const names = list.map((r) => r.name);
      if (names.length === 0) {
        setRemotesError("No remotes configured. Add a remote first.");
        setRemotes([]);
        return;
      }
      setRemotes(names);
      setSelectedRemote(names.includes(suggestedRemote) ? suggestedRemote : names[0]);
    }).catch(() => {
      setRemotesError("Failed to load remotes.");
      setRemotes([]);
    });
  }, [open, suggestedRemote]);

  const handleConfirm = async () => {
    setLoading(true);
    setPushError(null);
    try {
      await runGitOperation("Push (Set Upstream)", () => window.electronAPI.remote.push(selectedRemote, suggestedBranch, force, true));
      await Promise.all([refreshInfo(), refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setPushError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const confirmDisabled = !!remotesError || remotes.length === 0;

  return (
    <ModalDialog open={open} title="Set Upstream & Push" onClose={onClose} width={460}>
      {/* Branch → Remote row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Branch</div>
        <span className="badge badge-head-current">{suggestedBranch}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Remote</div>
        {remotesError ? (
          <span style={{ fontSize: 11, color: "var(--red)" }}>{remotesError}</span>
        ) : (
          <select
            value={selectedRemote}
            onChange={(e) => setSelectedRemote(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {remotes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )}
      </div>

      {/* Force push warning */}
      {force && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--red-dim)",
            border: "1px solid var(--red)",
            fontSize: 11,
            color: "var(--red)",
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          Force pushing will <strong>overwrite the remote branch history</strong>.
          Any commits pushed by other collaborators that are not in your local branch will be permanently lost.
        </div>
      )}

      <DialogError error={pushError} />

      <DialogActions
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel={force ? "Force Push & Set Upstream" : "Push & Set Upstream"}
        confirmColor={force ? "var(--red)" : undefined}
        loading={loading}
        disabled={confirmDisabled}
      />
    </ModalDialog>
  );
};
