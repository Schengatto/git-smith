import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogInput, DialogError } from "./ModalDialog";
import { useUIStore } from "../../store/ui-store";
import type { RemoteInfo } from "../../../shared/git-types";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const RemoteDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const showToast = useUIStore((s) => s.showToast);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadRemotes = async () => {
    try {
      const list = await window.electronAPI.remote.list();
      setRemotes(list);
    } catch (err: unknown) {
      showToast(`Failed to load remotes: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    if (open) {
      loadRemotes();
      setAddMode(false);
      setError(null);
    }
    // Only run when dialog opens/closes; loadRemotes is a local function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.remote.add(newName.trim(), newUrl.trim());
      setNewName("");
      setNewUrl("");
      setAddMode(false);
      await loadRemotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (name: string) => {
    setError(null);
    try {
      await window.electronAPI.remote.remove(name);
      await loadRemotes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ModalDialog open={open} title={t("remote.title")} onClose={onClose} width={520}>
      {/* Remote list */}
      <div
        style={{
          borderRadius: 8,
          border: "1px solid var(--border-subtle)",
          overflow: "hidden",
          marginBottom: 12,
        }}
      >
        {remotes.length === 0 ? (
          <div
            style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}
          >
            {t("remote.noRemotesConfigured")}
          </div>
        ) : (
          remotes.map((r, i) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderBottom: i < remotes.length - 1 ? "1px solid var(--border-subtle)" : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {r.name}
                </div>
                <div className="mono truncate" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {r.fetchUrl}
                </div>
              </div>
              <button
                onClick={() => handleRemove(r.name)}
                title={t("remote.removeRemote")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  borderRadius: 4,
                  display: "flex",
                  transition: "color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add remote */}
      {addMode ? (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--surface-0)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <DialogInput
            label={t("remote.remoteName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("remote.namePlaceholder")}
            autoFocus
          />
          <DialogInput
            label={t("remote.url")}
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={t("remote.urlPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
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
              onClick={handleAdd}
              disabled={!newName.trim() || !newUrl.trim() || loading}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                border: "none",
                background:
                  !newName.trim() || !newUrl.trim() ? "var(--surface-3)" : "var(--accent)",
                color:
                  !newName.trim() || !newUrl.trim() ? "var(--text-muted)" : "var(--text-on-color)",
                fontSize: 12,
                fontWeight: 600,
                cursor: !newName.trim() || !newUrl.trim() ? "not-allowed" : "pointer",
              }}
            >
              {t("dialogs.add")}
            </button>
          </div>
        </div>
      ) : (
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
          {t("remote.addRemote")}
        </button>
      )}

      <DialogError error={error} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          onClick={onClose}
          style={{
            padding: "7px 18px",
            borderRadius: 6,
            border: "none",
            background: "var(--surface-3)",
            color: "var(--text-primary)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {t("remote.done")}
        </button>
      </div>
    </ModalDialog>
  );
};
