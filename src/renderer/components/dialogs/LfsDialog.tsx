import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogActions, DialogError } from "./ModalDialog";

interface LfsStatus {
  installed: boolean;
  version: string;
  tracked: { pattern: string; filter: string }[];
  files: { path: string; lfsOid: string; size: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const LfsDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<LfsStatus | null>(null);
  const [info, setInfo] = useState<{ storagePath: string; endpoint: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "files">("overview");

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lfsStatus, lfsInfo] = await Promise.all([
        window.electronAPI.lfs.status(),
        window.electronAPI.lfs.info().catch(() => null),
      ]);
      setStatus(lfsStatus);
      setInfo(lfsInfo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setNewPattern("");
      setTab("overview");
      loadStatus();
    }
  }, [open]);

  const handleInstall = async () => {
    setActionInProgress(t("lfs.installingLfs"));
    setError(null);
    try {
      await window.electronAPI.lfs.install();
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleTrack = async () => {
    if (!newPattern.trim()) return;
    setActionInProgress(t("lfs.tracking", { pattern: newPattern }));
    setError(null);
    try {
      await window.electronAPI.lfs.track(newPattern.trim());
      setNewPattern("");
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUntrack = async (pattern: string) => {
    setActionInProgress(t("lfs.untracking", { pattern }));
    setError(null);
    try {
      await window.electronAPI.lfs.untrack(pattern);
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <ModalDialog open={open} title={t("lfs.title")} onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {loading ? (
          <div
            style={{ fontSize: 12, color: "var(--text-muted)", padding: 16, textAlign: "center" }}
          >
            {t("dialogs.loading")}
          </div>
        ) : !status?.installed ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {t("lfs.notInstalled")}
            </div>
            <button
              className="toolbar-btn"
              onClick={handleInstall}
              disabled={!!actionInProgress}
              style={{
                fontSize: 12,
                padding: "6px 16px",
                background: "var(--accent)",
                color: "var(--text-on-color)",
              }}
            >
              {t("lfs.installLfs")}
            </button>
          </div>
        ) : (
          <>
            {/* Version & Info */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              <span>{status.version}</span>
              {info?.endpoint && (
                <span title={info.endpoint}>
                  {t("lfs.endpoint")} {info.endpoint.slice(0, 40)}...
                </span>
              )}
            </div>

            {/* Tabs */}
            <div
              style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)" }}
            >
              {(["overview", "files"] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  onClick={() => setTab(tabKey)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 11,
                    fontWeight: 500,
                    border: "none",
                    borderBottom:
                      tab === tabKey ? "2px solid var(--accent)" : "2px solid transparent",
                    background: "transparent",
                    color: tab === tabKey ? "var(--accent)" : "var(--text-muted)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {tabKey === "overview"
                    ? `${t("lfs.trackedPatterns")} (${status.tracked.length})`
                    : `${t("lfs.lfsFiles")} (${status.files.length})`}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <>
                {/* Add pattern */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={newPattern}
                    onChange={(e) => setNewPattern(e.target.value)}
                    placeholder={t("lfs.trackPatternPlaceholder")}
                    onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      fontSize: 12,
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      background: "var(--surface-0)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    className="toolbar-btn"
                    onClick={handleTrack}
                    disabled={!newPattern.trim() || !!actionInProgress}
                    style={{ fontSize: 11, padding: "5px 12px" }}
                  >
                    {t("lfs.track")}
                  </button>
                </div>

                {/* Tracked patterns */}
                <div
                  style={{
                    maxHeight: 200,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  {status.tracked.length === 0 ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        padding: 12,
                        textAlign: "center",
                      }}
                    >
                      {t("lfs.noTrackedPatterns")}
                    </div>
                  ) : (
                    status.tracked.map((tp) => (
                      <div
                        key={tp.pattern}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 8px",
                          borderRadius: 4,
                          background: "var(--surface-0)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: 12,
                        }}
                      >
                        <span className="mono" style={{ flex: 1, color: "var(--text-primary)" }}>
                          {tp.pattern}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {tp.filter}
                        </span>
                        <button
                          className="toolbar-btn"
                          onClick={() => handleUntrack(tp.pattern)}
                          disabled={!!actionInProgress}
                          style={{ fontSize: 10, padding: "1px 6px", color: "var(--red)" }}
                        >
                          {t("lfs.untrack")}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {tab === "files" && (
              <div
                style={{
                  maxHeight: 250,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                {status.files.length === 0 ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      padding: 12,
                      textAlign: "center",
                    }}
                  >
                    {t("lfs.noLfsFiles")}
                  </div>
                ) : (
                  status.files.map((f) => (
                    <div
                      key={f.lfsOid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "3px 8px",
                        fontSize: 12,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {f.path}
                      </span>
                      <span
                        className="mono"
                        style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}
                      >
                        {f.lfsOid.slice(0, 10)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {actionInProgress && (
          <div style={{ fontSize: 11, color: "var(--accent)", padding: "2px 0" }}>
            {actionInProgress}
          </div>
        )}

        <DialogError error={error} />
      </div>

      <DialogActions onCancel={onClose} onConfirm={onClose} confirmLabel={t("dialogs.close")} />
    </ModalDialog>
  );
};
