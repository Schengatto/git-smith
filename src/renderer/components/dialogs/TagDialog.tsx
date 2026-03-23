import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ModalDialog,
  DialogInput,
  DialogActions,
  DialogError,
  DialogCheckbox,
} from "./ModalDialog";
import { useGraphStore } from "../../store/graph-store";

interface Props {
  open: boolean;
  onClose: () => void;
  commitHash: string;
  commitSubject: string;
}

export const CreateTagDialog: React.FC<Props> = ({ open, onClose, commitHash, commitSubject }) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [annotated, setAnnotated] = useState(true);
  const [pushToRemote, setPushToRemote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadGraph } = useGraphStore();

  useEffect(() => {
    if (open) {
      setName("");
      setMessage("");
      setAnnotated(true);
      setPushToRemote(false);
      setError(null);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.tag.create(
        name.trim(),
        commitHash,
        annotated ? message.trim() || name.trim() : undefined
      );

      if (pushToRemote) {
        await window.electronAPI.tag.push(name.trim());
      }

      await loadGraph();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("tag.createTitle")} onClose={onClose} width={460}>
      {/* Target commit */}
      <div
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          background: "var(--surface-0)",
          border: "1px solid var(--border-subtle)",
          marginBottom: 14,
        }}
      >
        <div className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>
          {commitHash.slice(0, 10)}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 2 }}>
          {commitSubject}
        </div>
      </div>

      <DialogInput
        label={t("tag.tagName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("tag.tagNamePlaceholder")}
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      />

      <DialogCheckbox label={t("tag.annotatedTag")} checked={annotated} onChange={setAnnotated} />

      {annotated && (
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text-muted)",
              marginBottom: 4,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {t("tag.messageLabel")}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={name || t("tag.messagePlaceholder")}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontFamily: "inherit",
              outline: "none",
              resize: "vertical",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />
        </div>
      )}

      <DialogCheckbox
        label={t("tag.pushAfterCreating")}
        checked={pushToRemote}
        onChange={setPushToRemote}
      />

      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleCreate}
        confirmLabel={pushToRemote ? t("tag.createAndPush") : t("tag.createTag")}
        disabled={!name.trim()}
        loading={loading}
      />
    </ModalDialog>
  );
};
