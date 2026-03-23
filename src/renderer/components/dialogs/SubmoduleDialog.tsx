import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  hash: string;
  branch: string;
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SubmoduleDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();
  const [submodules, setSubmodules] = useState<SubmoduleInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadSubmodules = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await window.electronAPI.submodule.status();
      setSubmodules(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadSubmodules();
  }, [open]);

  const handleUpdate = async (init: boolean) => {
    setActionInProgress(init ? t("submodule.initializingAndUpdating") : t("submodule.updating"));
    setError(null);
    try {
      await window.electronAPI.submodule.update(init);
      await Promise.all([loadSubmodules(), refreshStatus(), loadGraph()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSync = async () => {
    setActionInProgress(t("submodule.syncing"));
    setError(null);
    try {
      await window.electronAPI.submodule.sync();
      await Promise.all([loadSubmodules(), refreshStatus(), loadGraph()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeinit = async (subPath: string) => {
    setActionInProgress(t("submodule.deinitializing", { path: subPath }));
    setError(null);
    try {
      await window.electronAPI.submodule.deinit(subPath, true);
      await Promise.all([loadSubmodules(), refreshStatus(), loadGraph()]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "up-to-date":
        return "var(--green)";
      case "modified":
        return "var(--peach)";
      case "uninitialized":
        return "var(--text-muted)";
      case "conflict":
        return "var(--red)";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <ModalDialog open={open} title={t("submodule.title")} onClose={onClose} width={580}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            className="toolbar-btn"
            onClick={() => handleUpdate(true)}
            disabled={!!actionInProgress}
            style={{ fontSize: 11, padding: "4px 10px" }}
          >
            {t("submodule.initAndUpdate")}
          </button>
          <button
            className="toolbar-btn"
            onClick={() => handleUpdate(false)}
            disabled={!!actionInProgress}
            style={{ fontSize: 11, padding: "4px 10px" }}
          >
            {t("submodule.update")}
          </button>
          <button
            className="toolbar-btn"
            onClick={handleSync}
            disabled={!!actionInProgress}
            style={{ fontSize: 11, padding: "4px 10px" }}
          >
            {t("submodule.sync")}
          </button>
          <button
            className="toolbar-btn"
            onClick={loadSubmodules}
            disabled={!!actionInProgress}
            style={{ fontSize: 11, padding: "4px 10px" }}
          >
            {t("submodule.refresh")}
          </button>
        </div>

        {actionInProgress && (
          <div style={{ fontSize: 11, color: "var(--accent)", padding: "4px 0" }}>
            {actionInProgress}
          </div>
        )}

        {/* Submodule list */}
        {loading ? (
          <div
            style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" }}
          >
            {t("submodule.loading")}
          </div>
        ) : submodules.length === 0 ? (
          <div
            style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" }}
          >
            {t("submodule.noSubmodulesFound")}
          </div>
        ) : (
          <div
            style={{
              maxHeight: 300,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {submodules.map((sub) => (
              <div
                key={sub.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "var(--surface-0)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {sub.path}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: statusColor(sub.status) + "22",
                        color: statusColor(sub.status),
                        fontWeight: 600,
                        textTransform: "uppercase",
                      }}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
                    {sub.url && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }} title={sub.url}>
                        {sub.url.length > 50 ? "..." + sub.url.slice(-47) : sub.url}
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {sub.hash.slice(0, 7)}
                    </span>
                    {sub.branch && (
                      <span style={{ fontSize: 10, color: "var(--accent)" }}>{sub.branch}</span>
                    )}
                  </div>
                </div>
                <button
                  className="toolbar-btn"
                  onClick={() => handleDeinit(sub.path)}
                  disabled={!!actionInProgress}
                  style={{ fontSize: 10, padding: "2px 8px", color: "var(--red)" }}
                  title={t("submodule.deinitializeSubmodule")}
                >
                  {t("submodule.deinit")}
                </button>
              </div>
            ))}
          </div>
        )}

        <DialogError error={error} />
      </div>

      <DialogActions onCancel={onClose} onConfirm={onClose} confirmLabel={t("dialogs.close")} />
    </ModalDialog>
  );
};
