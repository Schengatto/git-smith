import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogActions, DialogError, DialogInput } from "./ModalDialog";
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
  const { t } = useTranslation();
  const { refreshInfo, refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const [remotes, setRemotes] = useState<string[]>([]);
  const [selectedRemote, setSelectedRemote] = useState(suggestedRemote);
  const [remotesError, setRemotesError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [newRemoteName, setNewRemoteName] = useState("");
  const [newRemoteUrl, setNewRemoteUrl] = useState("");
  const [addingRemote, setAddingRemote] = useState(false);
  const suggestedRemoteRef = useRef(suggestedRemote);
  suggestedRemoteRef.current = suggestedRemote;

  const applyRemoteList = (names: string[]) => {
    if (names.length === 0) {
      setRemotesError(t("setUpstream.noRemotes"));
      setRemotes([]);
      return;
    }
    setRemotesError(null);
    setRemotes(names);
    const preferred = suggestedRemoteRef.current;
    setSelectedRemote(names.includes(preferred) ? preferred : names[0]!);
  };

  useEffect(() => {
    if (!open) return;
    setRemotesError(null);
    setPushError(null);
    setLoading(false);
    setAddMode(false);
    setNewRemoteName("");
    setNewRemoteUrl("");

    window.electronAPI.remote
      .list()
      .then((list) => applyRemoteList(list.map((r) => r.name)))
      .catch(() => {
        setRemotesError(t("setUpstream.failedToLoadRemotes"));
        setRemotes([]);
      });
  }, [open, suggestedRemote]);

  const handleAddRemote = async () => {
    if (!newRemoteName.trim() || !newRemoteUrl.trim()) return;
    setAddingRemote(true);
    setPushError(null);
    try {
      await window.electronAPI.remote.add(newRemoteName.trim(), newRemoteUrl.trim());
      setAddMode(false);
      setNewRemoteName("");
      setNewRemoteUrl("");
      const list = await window.electronAPI.remote.list();
      applyRemoteList(list.map((r) => r.name));
    } catch (err: unknown) {
      setPushError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingRemote(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setPushError(null);
    try {
      await runGitOperation("Push (Set Upstream)", () =>
        window.electronAPI.remote.push(selectedRemote, suggestedBranch, force, true)
      );
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
    <ModalDialog open={open} title={t("setUpstream.title")} onClose={onClose} width={460}>
      {/* Branch → Remote row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("setUpstream.branch")}</div>
        <span className="badge badge-head-current">{suggestedBranch}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("setUpstream.remote")}</div>
        {remotesError && !addMode ? (
          <span style={{ fontSize: 11, color: "var(--red)" }}>{remotesError}</span>
        ) : remotesError && addMode ? null : (
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
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Add remote inline form */}
      {remotesError && !addMode && (
        <button
          onClick={() => setAddMode(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px dashed var(--border)",
            background: "transparent",
            color: "var(--text-muted)",
            fontSize: 12,
            cursor: "pointer",
            width: "100%",
            marginBottom: 12,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("setUpstream.addRemote")}
        </button>
      )}

      {addMode && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--surface-0)",
            border: "1px solid var(--border-subtle)",
            marginBottom: 12,
          }}
        >
          <DialogInput
            label={t("setUpstream.remoteName")}
            value={newRemoteName}
            onChange={(e) => setNewRemoteName(e.target.value)}
            placeholder="origin"
            autoFocus
          />
          <DialogInput
            label={t("setUpstream.remoteUrl")}
            value={newRemoteUrl}
            onChange={(e) => setNewRemoteUrl(e.target.value)}
            placeholder="https://github.com/user/repo.git"
            onKeyDown={(e) => e.key === "Enter" && handleAddRemote()}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={() => setAddMode(false)}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text-secondary)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {t("dialogs.cancel")}
            </button>
            <button
              onClick={handleAddRemote}
              disabled={!newRemoteName.trim() || !newRemoteUrl.trim() || addingRemote}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "none",
                background:
                  !newRemoteName.trim() || !newRemoteUrl.trim()
                    ? "var(--surface-3)"
                    : "var(--accent)",
                color:
                  !newRemoteName.trim() || !newRemoteUrl.trim()
                    ? "var(--text-muted)"
                    : "var(--text-on-color)",
                fontSize: 12,
                fontWeight: 600,
                cursor: !newRemoteName.trim() || !newRemoteUrl.trim() ? "not-allowed" : "pointer",
              }}
            >
              {t("setUpstream.add")}
            </button>
          </div>
        </div>
      )}

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
          {t("setUpstream.forcePushWarning")}
        </div>
      )}

      <DialogError error={pushError} />

      <DialogActions
        onCancel={onClose}
        onConfirm={handleConfirm}
        confirmLabel={
          force ? t("setUpstream.forcePushAndSetUpstream") : t("setUpstream.pushAndSetUpstream")
        }
        confirmColor={force ? "var(--red)" : undefined}
        loading={loading}
        disabled={confirmDisabled}
      />
    </ModalDialog>
  );
};
