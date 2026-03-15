import React, { useState, useEffect } from "react";
import { ModalDialog, DialogInput, DialogActions, DialogError } from "./ModalDialog";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const CreateStashDialog: React.FC<Props> = ({ open, onClose }) => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  useEffect(() => {
    if (open) { setMessage(""); setError(null); }
  }, [open]);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.stash.create(message.trim() || undefined);
      await Promise.all([refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog open={open} title="Stash Changes" onClose={onClose}>
      <DialogInput
        label="Message (optional)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="WIP: description"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      />
      <DialogError error={error} />
      <DialogActions
        onCancel={onClose}
        onConfirm={handleCreate}
        confirmLabel="Stash"
        loading={loading}
      />
    </ModalDialog>
  );
};
