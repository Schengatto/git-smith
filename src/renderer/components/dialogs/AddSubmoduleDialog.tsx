import React, { useState, useEffect } from "react";
import { ModalDialog, DialogInput, DialogActions, DialogError } from "./ModalDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const AddSubmoduleDialog: React.FC<Props> = ({ open, onClose }) => {
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
    <ModalDialog open={open} title="Add Submodule" onClose={onClose} width={460}>
      <DialogInput
        label="Repository URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://github.com/user/repo.git"
        autoFocus
      />
      <DialogInput
        label="Path (optional)"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="Leave empty to use repo name"
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleAdd}
        confirmLabel="Add Submodule"
        disabled={!url.trim()}
        loading={loading}
      />
    </ModalDialog>
  );
};
