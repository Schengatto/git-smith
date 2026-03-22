import React, { useState } from "react";
import { ModalDialog, DialogActions } from "./ModalDialog";
import { runGitOperation, GitOperationCancelledError } from "../../store/git-operation-store";
import { useRepoStore } from "../../store/repo-store";
import { useGraphStore } from "../../store/graph-store";

interface CreateProps {
  open: boolean;
  onClose: () => void;
  hashes: string[];
  subjects: string[];
}

export const PatchCreateDialog: React.FC<CreateProps> = ({ open, onClose, hashes, subjects }) => {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCreate = async () => {
    setError("");
    setSuccess("");
    const dir = await window.electronAPI.repo.browseDirectory(
      "Select output directory for patches"
    );
    if (!dir) return;
    try {
      const files = await runGitOperation("format-patch", () =>
        window.electronAPI.patch.create(hashes, dir)
      );
      setSuccess(`Created ${files.length} patch file(s) in ${dir}`);
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ModalDialog open={open} title="Create Patch" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Create patch file(s) for {hashes.length} commit(s):
        </div>
        <div
          style={{
            maxHeight: 150,
            overflow: "auto",
            background: "var(--surface-0)",
            borderRadius: 6,
            padding: "6px 10px",
          }}
        >
          {subjects.map((s, i) => (
            <div
              key={hashes[i]}
              style={{ fontSize: 11, color: "var(--text-primary)", padding: "2px 0" }}
            >
              <span className="mono" style={{ color: "var(--accent)" }}>
                {hashes[i]!.slice(0, 7)}
              </span>{" "}
              {s}
            </div>
          ))}
        </div>
        {error && <div style={{ fontSize: 11, color: "var(--red)" }}>{error}</div>}
        {success && <div style={{ fontSize: 11, color: "var(--green)" }}>{success}</div>}
      </div>
      <DialogActions onCancel={onClose} onConfirm={handleCreate} confirmLabel="Create Patch" />
    </ModalDialog>
  );
};

interface ApplyProps {
  open: boolean;
  onClose: () => void;
}

export const PatchApplyDialog: React.FC<ApplyProps> = ({ open, onClose }) => {
  const [patchPath, setPatchPath] = useState("");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const { refreshStatus } = useRepoStore();
  const { loadGraph } = useGraphStore();

  const handleBrowse = async () => {
    const file = await window.electronAPI.repo.browseFile("Select patch file");
    if (file) {
      setPatchPath(file);
      setError("");
      try {
        const stat = await window.electronAPI.patch.preview(file);
        setPreview(stat);
      } catch {
        setPreview("");
      }
    }
  };

  const handleApply = async () => {
    if (!patchPath) {
      setError("Select a patch file");
      return;
    }
    setError("");
    try {
      await runGitOperation("apply", () => window.electronAPI.patch.apply(patchPath));
      await Promise.all([refreshStatus(), loadGraph()]);
      onClose();
    } catch (err: unknown) {
      if (err instanceof GitOperationCancelledError) return;
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <ModalDialog open={open} title="Apply Patch" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="text"
            value={patchPath}
            readOnly
            placeholder="Select a patch file..."
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "var(--surface-0)",
              color: "var(--text-primary)",
            }}
          />
          <button
            className="toolbar-btn"
            onClick={handleBrowse}
            style={{ fontSize: 11, padding: "5px 12px" }}
          >
            Browse
          </button>
        </div>

        {preview && (
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              background: "var(--surface-0)",
              padding: "6px 10px",
              borderRadius: 6,
              whiteSpace: "pre-wrap",
              maxHeight: 150,
              overflow: "auto",
            }}
          >
            {preview}
          </div>
        )}

        {error && <div style={{ fontSize: 11, color: "var(--red)" }}>{error}</div>}
      </div>
      <DialogActions onCancel={onClose} onConfirm={handleApply} confirmLabel="Apply" />
    </ModalDialog>
  );
};
