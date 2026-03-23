import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogActions, DialogError, DialogCheckbox } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";

function joinPath(base: string, sub: string): string {
  const sep = base.includes("\\") ? "\\" : "/";
  const trimmed = base.replace(/[/\\]+$/, "");
  return `${trimmed}${sep}${sub}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const inputRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  minWidth: 130,
  flexShrink: 0,
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
  transition: "border-color 0.15s",
  minWidth: 0,
};

const browseButtonStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface-0)",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
  minWidth: 0,
};

const infoBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 6,
  background: "var(--surface-0)",
  border: "1px solid var(--border)",
  fontSize: 12,
  color: "var(--text-secondary)",
  marginBottom: 16,
  lineHeight: 1.5,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 8,
};

export const CloneDialog: React.FC<Props> = ({ open, onClose }) => {
  const { openRepo } = useRepoStore();
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [destination, setDestination] = useState("");
  const [subdirectory, setSubdirectory] = useState("");
  const [branch, setBranch] = useState("");
  const [bare, setBare] = useState(false);
  const [recurseSubmodules, setRecurseSubmodules] = useState(true);
  const [fullHistory, setFullHistory] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const branchFetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setUrl("");
      setDestination("");
      setSubdirectory("");
      setBranch("");
      setBare(false);
      setRecurseSubmodules(true);
      setFullHistory(true);
      setError(null);
      setProgress(null);
      setRemoteBranches([]);
    }
  }, [open]);

  // Auto-fill subdirectory from URL
  useEffect(() => {
    if (!url) {
      setSubdirectory("");
      return;
    }
    try {
      const cleaned = url.replace(/\.git\/?$/, "").replace(/\/$/, "");
      const parts = cleaned.split("/");
      const name = parts[parts.length - 1] || "";
      if (name) setSubdirectory(name);
    } catch {
      /* empty */
    }
  }, [url]);

  // Debounced fetch of remote branches when URL changes
  const fetchBranches = useCallback(async (repoUrl: string) => {
    if (!repoUrl.trim()) {
      setRemoteBranches([]);
      return;
    }
    setLoadingBranches(true);
    try {
      const branches = await window.electronAPI.remote.listRemoteBranches(repoUrl.trim());
      setRemoteBranches(branches);
    } catch {
      setRemoteBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  }, []);

  useEffect(() => {
    if (branchFetchTimeout.current) {
      clearTimeout(branchFetchTimeout.current);
    }
    if (!url.trim()) {
      setRemoteBranches([]);
      return;
    }
    branchFetchTimeout.current = setTimeout(() => {
      fetchBranches(url);
    }, 800);
    return () => {
      if (branchFetchTimeout.current) {
        clearTimeout(branchFetchTimeout.current);
      }
    };
  }, [url, fetchBranches]);

  const finalPath =
    destination && subdirectory
      ? joinPath(destination, subdirectory)
      : destination
        ? `${destination}/${subdirectory || "..."}`
        : subdirectory
          ? `[Destination]/${subdirectory}`
          : "";

  const handleBrowseDestination = async () => {
    const dir = await window.electronAPI.repo.browseDirectory("Select clone destination");
    if (dir) setDestination(dir);
  };

  const handleClone = async () => {
    if (!url.trim() || !destination.trim() || !subdirectory.trim()) return;
    setLoading(true);
    setError(null);
    setProgress(t("clone.cloning"));
    try {
      const clonePath = joinPath(destination, subdirectory);
      await window.electronAPI.remote.clone(url.trim(), clonePath, {
        branch: branch || undefined,
        bare,
        recurseSubmodules,
        shallow: !fullHistory,
      });
      if (!bare) {
        setProgress(t("clone.opening"));
        await openRepo(clonePath);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  const canClone = url.trim() && destination.trim() && subdirectory.trim();

  return (
    <ModalDialog open={open} title={t("clone.title")} onClose={onClose} width={580}>
      {/* Repository to clone */}
      <div style={inputRowStyle}>
        <label style={labelStyle}>{t("clone.repoToClone")}</label>
        <input
          style={inputStyle}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("clone.repoUrlPlaceholder")}
          autoFocus
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {/* Destination */}
      <div style={inputRowStyle}>
        <label style={labelStyle}>{t("clone.destination")}</label>
        <input
          style={inputStyle}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder={t("clone.destinationPlaceholder")}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
        <button
          style={browseButtonStyle}
          onClick={handleBrowseDestination}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-3)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
        >
          {t("dialogs.browse")}
        </button>
      </div>

      {/* Subdirectory to create */}
      <div style={inputRowStyle}>
        <label style={labelStyle}>{t("clone.subdirectory")}</label>
        <input
          style={inputStyle}
          value={subdirectory}
          onChange={(e) => setSubdirectory(e.target.value)}
          placeholder={t("clone.subdirectoryPlaceholder")}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
        />
      </div>

      {/* Branch */}
      <div style={inputRowStyle}>
        <label style={labelStyle}>{t("clone.branch")}</label>
        <select style={selectStyle} value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">{t("clone.defaultRemoteHead")}</option>
          {remoteBranches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {loadingBranches && (
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {/* Clone destination info */}
      {finalPath && (
        <div style={infoBoxStyle}>
          {t("clone.cloneLocationInfo")}
          <br />
          <span style={{ color: "var(--accent)", fontWeight: 500 }}>{finalPath}</span>
        </div>
      )}

      {/* Repository type */}
      <div style={{ marginBottom: 12 }}>
        <div style={sectionLabelStyle}>{t("clone.repositoryType")}</div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 6,
            userSelect: "none",
          }}
        >
          <input
            type="radio"
            name="repoType"
            checked={!bare}
            onChange={() => setBare(false)}
            style={{ accentColor: "var(--accent)" }}
          />
          {t("clone.personalRepo")}
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 12,
            color: "var(--text-secondary)",
            userSelect: "none",
          }}
        >
          <input
            type="radio"
            name="repoType"
            checked={bare}
            onChange={() => setBare(true)}
            style={{ accentColor: "var(--accent)" }}
          />
          {t("clone.bareRepo")}
        </label>
      </div>

      {/* Checkboxes */}
      <div style={{ marginBottom: 4 }}>
        <DialogCheckbox
          label={t("clone.initSubmodules")}
          checked={recurseSubmodules}
          onChange={setRecurseSubmodules}
        />
        <DialogCheckbox
          label={t("clone.downloadFullHistory")}
          checked={fullHistory}
          onChange={setFullHistory}
        />
      </div>

      {progress && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 0",
            fontSize: 12,
            color: "var(--accent)",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          {progress}
        </div>
      )}

      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleClone}
        confirmLabel={t("clone.clone")}
        disabled={!canClone}
        loading={loading}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ModalDialog>
  );
};
