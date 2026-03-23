import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog, DialogInput, DialogActions, DialogError } from "./ModalDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const AddSubmoduleDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setPath("");
      setError(null);
    }
  }, [open]);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.submodule.add(url.trim(), path.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title={t("submodule.addTitle")} onClose={onClose} width={460}>
      <DialogInput
        label={t("submodule.repoUrl")}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/user/repo.git"
        autoFocus
      />
      <DialogInput
        label={t("submodule.pathOptional")}
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder={t("submodule.pathPlaceholder")}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleAdd}
        confirmLabel={t("submodule.addSubmodule")}
        disabled={!url.trim()}
        loading={loading}
      />
    </ModalDialog>
  );
};
